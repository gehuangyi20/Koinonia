#!/usr/bin/env python

"""
Provisioner for the Ecliptic voting system
Purpose:
    - programatically try to setup tunnels to each of the tellers
    - act as a proxy for multiplexing messages to the correct tunnels
"""

import argparse
import os
import time
import shutil
import subprocess
import random
import ElectionSetupParser as esp
import HttpProxyServer as hps
import port_for as pf
from urlparse import urlparse
import thread
import signal

FF_PROFILE_DIR = "/tmp/eclipticFF.profile"

def getPossiblePorts(n):
    """Randomly choose some available ports for future use"""
    return random.sample(pf.available_good_ports(), n)

def runFf(profileDir):
    """run a FF instance"""
    os.system("firefox -no-remote -profile "+profileDir)

def newFfProfile(profileDir):
    """Create a new FF profile"""
    shutil.rmtree(profileDir, ignore_errors=True)
    os.system("mkdir -p "+profileDir)
    
    # create profile is not necessary
    # it only creates an empty dir (which we did already)
    # it leaves a dangling profile on the user's FF
    # os.system('firefox -no-remote -CreateProfile "ecliptic {}"'.format(FF_PROFILE_DIR))

def fixFfPrefHttpProxyPort(profileDir, port_num):
    with open(os.path.join(profileDir, 'prefs.js'), 'a') as prof_file:
        prof_file.write('\nuser_pref("network.proxy.http_port", {});\n'.format(port_num))
    print "[*] Configured FF profile to use 127.0.0.1:{} for HTTP proxy".format(port_num)

def fixFfPrefElectionUrl(profileDir, eurl):
    with open(os.path.join(profileDir, 'prefs.js'), 'a') as prof_file:
        prof_file.write('\nuser_pref("browser.startup.homepage", "{}");\n'.format(eurl))
    print "[*] Configured FF profile to show {} as homepage".format(eurl)

def copyFfPref(profileDir):
    """Copy FF profile to the new profile"""
    prefFile = os.path.dirname(os.path.realpath(__file__))+"/FirefoxProfile/prefs.js"
    os.system("cp "+prefFile+" "+profileDir)
    chromeDir = os.path.dirname(os.path.realpath(__file__))+"/FirefoxProfile/chrome"
    os.system("cp -R "+chromeDir+" "+profileDir)

def genStunnelConfig(fn, ports, tellers):
    """Generate a client config file for stunnel"""
    with open(fn, 'w') as f:
        f.write('client = yes\n')
        f.write('debug = 7\nforeground = yes\n')
        f.write('syslog = no\n')
        for i in range(len(tellers)):
            f.write('\n[teller--({})]\n'.format(i-1))
            f.write('accept = 127.0.0.1:{}\n'.format(ports[i]))
            f.write('connect = {}\n'.format(tellers[i]))
            f.write('ciphers = ')
            f.write('OQSKEX-GENERIC:OQSKEX-GENERIC-ECDHE:')
            f.write('OQSKEX-RLWE-BCNS15:OQSKEX-RLWE-BCNS15-ECDHE:')
            f.write('OQSKEX-RLWE-NEWHOPE:OQSKEX-RLWE-NEWHOPE-ECDHE:OQSKEX-RLWE-MSRLN16:')
            f.write('OQSKEX-RLWE-MSRLN16-ECDHE:OQSKEX-LWE-FRODO-RECOMMENDED:')
            f.write('OQSKEX-LWE-FRODO-RECOMMENDED-ECDHE:OQSKEX-SIDH-CLN16:OQSKEX-SIDH-CLN16-ECDHE\n')

def runStunnel(stunnel_bin, stunnel_config_file):
    proc = subprocess.Popen([stunnel_bin, stunnel_config_file], stderr=subprocess.PIPE)

    hiatus = 3
    time.sleep(hiatus)
    print "[*] Now sleep for {} seconds to wait for stunnel to settle down ...".format(hiatus)

    line = proc.stderr.readline()
    while line:
        if 'Error binding service' in line:
            return -1
        elif 'Configuration successful' in line:
            return 0
        line = proc.stderr.readline()

if __name__ == "__main__":

    # first setup the cmd-line args
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument("esp_apiurl", help="URL of the ESP Info API")
    arg_parser.add_argument("electionurl", help="URL of the Election for a particular user")
    args = arg_parser.parse_args()

    election_url = args.electionurl
    # election_url = str(args.apiurl).replace('/electionapi/', '/election/').replace('https://', 'http://')

    # get the list of teller addresses, teller tunnelling addresses, and authority tunnel port
    (tellers, teller_tunnels) = esp.getAddrAndPortsFromApi(args.esp_apiurl)

    # get a candidate list of ports for the tellers (and authority)
    teller_ports = getPossiblePorts(len(tellers))

    # create a folder for all our generated configs
    newFfProfile(FF_PROFILE_DIR)

    # generate config file for stunnel
    stunnel_config_file = os.path.join(FF_PROFILE_DIR, 'stunnel-client.conf')
    genStunnelConfig(stunnel_config_file, teller_ports, teller_tunnels)

    # run stunnel
    stunnel_bin = os.path.join(os.path.dirname(os.path.realpath(__file__)),
        'stunnel-5.40-oqs-build/bin/stunnel')
    ret = runStunnel(stunnel_bin, stunnel_config_file)

    # retry if stunnel fails
    while ret < 0:
        print "[!] Failed in binding, try different ports"
        teller_ports = getPossiblePorts(len(tellers)) # get new random ports
        genStunnelConfig(stunnel_config_file, teller_ports, tellers) # regen stunnel config
        ret = runStunnel(stunnel_bin, stunnel_config_file) # see if this will run

    print "[*] Stunnel seems to be running fine"

    # update preferences in FF profile
    copyFfPref(FF_PROFILE_DIR) # copy base preference
    proxy_port = pf.select_random()
    fixFfPrefHttpProxyPort(FF_PROFILE_DIR, proxy_port) # fix HTTP proxy port
    fixFfPrefElectionUrl(FF_PROFILE_DIR, election_url) # fix election url (homepage of FF)

    # run the HTTP proxy
    thread.start_new_thread(hps.startProxyServer, 
                            (proxy_port, 4096, 10485760, tuple(tellers), tuple(teller_ports)))

    # wait a while for the proxy to get ready
    time.sleep(3)

    # finally we can run FF to let user vote
    print "[*] Now everything is ready, launching FF, have fun ..."
    runFf(FF_PROFILE_DIR)

    os.kill(os.getpid(),signal.SIGINT)



