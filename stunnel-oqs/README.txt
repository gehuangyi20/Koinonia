Pre-requisite:
    https://pypi.python.org/pypi/port-for/
    (You should be able to install this easily through pip)

Steps:
    1. run ecliptic/stunnel-oqs/build-stunnel.sh
        ==> after this, a binary of stunnel will be available in ecliptic/stunnel-oqs/stunnel-5.40-oqs-build/bin

    2. run ecliptic/stunnel-oqs/provisioner.py with election API url and voter's voting link
        (the provisioner is made for voters, start this after getting the email, use option -h to see what are the expected command line arguments)

    3. (optional for localhost-based demo) run "server-side stunnel", e.g.
        ecliptic/stunnel-oqs/stunnel-5.40-oqs-build/bin/stunnel ecliptic/stunnel-oqs/stunnel-localhost-servers-demo.conf
        (adjust the ports in stunnel-localhost-servers-demo.conf if necessary; currently I assume teller{1-3} listens for incoming HTTP at port {50001-50003} respectively, and the expected stunnel ports are {40001-40003} respectively)


