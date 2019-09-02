#!/usr/bin/env python

import json
import requests
import sys
from urlparse import urlparse


def getAddrAndPortsFromApi(esp_api_url):
    """
    Fetch list of tellers from an API URL
    Returns (a, b), where:
        a is the list of original teller http addresses
        b is the list of teller addresses with tunnel ports
    """
    
    auth_api_url = None
    teller_addr_list = []
    teller_tunnel_list = []
    auth_tunnel_port = None
    esp_tunnel_port = None

    r = requests.get(esp_api_url)
    print "[*] ESP Info API - HTTP STATUS: {}".format(r.status_code)
    if r.status_code == 200:
        esp_tunnel_port = r.json()[u'tunnelPort']
        auth_api_url = r.json()[u'authProtocol']+u'//'+r.json()[u'authHostname']+u':'+str(r.json()[u'authPort']) + esp_api_url[esp_api_url.find(u'/electionapi'):]

    print "auth_api_url = ", auth_api_url

    auth_addr = urlparse(auth_api_url).netloc
    esp_addr = urlparse(esp_api_url).netloc

    r = requests.get(auth_api_url)
    print "[*] Auth Election Info API - HTTP STATUS: {}".format(r.status_code)
    if r.status_code == 200:
        for teller in r.json()[u'teller']:
            teller_addr_list.append("{}:{}".format(teller[u'hostname'], teller[u'port']))
            teller_tunnel_list.append("{}:{}".format(teller[u'hostname'], teller[u'tunnel_port']))
    auth_tunnel_port = r.json()[u'tunnel_port']

    auth_tunnel = auth_addr.replace(':'+str(urlparse(auth_api_url).port), ':'+str(auth_tunnel_port))
    esp_tunnel = esp_addr.replace(':'+str(urlparse(esp_api_url).port), ':'+str(esp_tunnel_port))
    print "[*] Authority address {}, tunneling at {}".format(auth_addr, auth_tunnel)
    print "[*] ESP address {}, tunneling at {}".format(esp_addr, esp_tunnel)

    # add authority to the top of the lists
    teller_addr_list.insert(0, auth_addr)
    teller_tunnel_list.insert(0, auth_tunnel)
    teller_addr_list.insert(0, esp_addr)
    teller_tunnel_list.insert(0, esp_tunnel)

    return (teller_addr_list, teller_tunnel_list)

if __name__ == "__main__":
    tellers = getAddrAndPortsFromApi('http://localhost:60001/electionapi/1')
    print tellers
