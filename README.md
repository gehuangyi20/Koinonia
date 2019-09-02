# Koinonia
The Koinonia system is an implementation of the Koinonia voting protocol. The protocol contains three independent servers (ESP, EA, and Tellers) which are recommended to be running on different machines. We use PostgreSQL (v9.6) on ESP, EA, and Tellers as the database back-end for storing election data. Clients will get the Voter application from the Authority and execute it on a Web browser. Both server-side and client-side applications are written in Node.js (v12) and use an abstract Koinonia library to get access to protocol functions such as vote share generation and proof verification. To accomodate the different deployment and optimization needs, we have thus made two implementations of the Koinonia library, one for client-side and the other for server-side. The client-side library is implemented with 500+ lines of JavaScript code based on SJCL. The server-side library is implemented through Node.js C++ Addons (1200 lines of native code) in order to optimize the performance of group exponentiations. The released software has been tested on Ubuntu 18.04.

The Readme contains instructions to deploy and test the Koinonia system involving multiple servers (e.g., one ESP, one EA, and three Tellers). Also, the Readme provides a performance benchmark script to stress test the system with one million ballots under the multi-server setting. Beyond the Koinonia system, we also release an implementation of secure communication channel establishment using experimental quantum-safe cryptographic algorithms, based on Open Quantum Safe (OQS) and Stunnel.

The source code can be found at
[https://github.com/gehuangyi20/Koinonia](https://github.com/gehuangyi20/Koinonia).

## Installing Software
- The instruction of installation is tested on Ubuntu 18.04+
- Node.js v12.x+
- PostgreSQL v9.6

##### 1. Install Nodejs
```bash
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs
```

##### 2. Install PostgreSQL

- create the file `/etc/apt/sources.list.d/pgdg.list`, and add a line for the repository

    `deb http://apt.postgresql.org/pub/repos/apt/ YOUR_UBUNTU_VERSION_HERE-pgdg main`

- Import the repository signing key, and update the package lists
    ```bash
    wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
        sudo apt-key add -
    sudo apt-get update
    sudo apt-get install postgresql-9.6
    ```

- Use password as authentication method for PostgreSQL
    - Change the password
    ```bash
    sudo -u postgres psql -p [port number]
    ALTER USER postgres WITH PASSWORD [new password];
    ```

    port number can be find in `/etc/postgresql/[pg version]/postgresql.conf`
    By default, the port number is 5432, unless multi version pg server
    is installed.

    - Configure postgresql to do password-based login.<br/>
    By default postgres uses peer authentication. We need to
    login the postgres server and change the postgres password

        - edit `/etc/postgresql/9.6/main/pg_hba.conf`
        - change authentication method from `peer` to `md5`

## Setup software environment

- Install node module
    ```bash
    npm install
    ```

- Get the "sjcl" as a git sub module
    ```bash
    git submodule init
    git submodule update
    ```

- Compile "sjcl" with ecc
    ```bash
    cd external/sjcl
    ./configure --with-ecc --with-cbc
    make
    ```
    the compiled `sjcl.js` has already has a symbolic link under `src/common/sjcl.js`

- Compile native module
    ```bash
    node-gyp configure
    node-gyp build
    ```
    You should run the command under project root directory.

- System parameter generation
    Generate the system parameter (curve_name and h).
    ```bash
    cd src/common
    nodejs paramSetup.js > parameter.js
    ```


    The parameter setup script `paramSetup.js` computes `digest(common string)` which is the
    $x$ coordinate in the EC (elliptic curve equation) (`$y^2 = x^3 + ax + b$`).
    The bit $b$ is to determine which $y$ coordinate we want to use (1 refers
    to odd $y$, and 0 refers to even $y$). $x$ plus bit $b$ is the compressed
    format of an EC point $h = (x, y)$. Notice that not every $x$ has a
    solution $y$. Therefore, the script repeat adds 1 to $x$ until finding
    a valid $x$.
    - command option for `paramSetup.js`
      - -n [curve name]<br/>
        --name=[curve name] elliptic curve name, currently only secp256k1,
        prime256v1, secp256r1 (alias of prime256v1), secp384r1, and secp521r1
        are supported [default: prime256v1]
      - -d [digest algorithm]<br/>
        --digest=[digest algorithm] digest algorithm [default: sha256]
      - -s [common string]<br/>
        --str=[common string] a common string used for generate h
        [default: hello world]
      - -b [bit]<br/>
        --bit=[bit], a bit (either 0 or 1) used for generate h. [default: 1]

- Compile common.js
    ```bash
    ./build-scripts/browserify.sh
    ```
    You need to re-compile the `common.js` if system parameter is re-generated.

- Setup database
    ```bash
    psql -U postgres -p [port number]
    \i ecliptic.sql
    ```
    `ecliptic.sql` is located in project root directory. Please run
    command `psql` under project root directory.


## Start the Koinonia servers

- Server Key generation (applicable to Auth, ESP and Tellers)
    - key file generation, here gives elliptic curve example (other key types like rsa also support)    
    `openssl ecparam -genkey -name [curve name] -out priv.pem`
    - for [curve name] secp256k1 is k256, prime256v1 is p256,
    - To get full curve list, use command:    
    `openssl ecparam -list_curves`
    - Encrypt private key file (you can other encryption algorithm in openssl)
    w/ password. The password is needed to decrypt the key when starting the
    server.
    `openssl pkey -in [private key file] -aes256 -out [output filename]`

    - Example for generating `Auth` server key:
    ```bash
    openssl ecparam -genkey -name prime256v1 -out src/auth/priv.pem
    openssl pkey -in src/auth/priv.pem -aes256 -out src/auth/priv.pem.enc
    ```

- Start Auth server
    ```bash
    nodejs auth-server.js [key file password] [key file] [host port]
    cd src/auth
    ```
    Example for generating Auth server key and starting Auth using port 60000
    ```Bash
    cd src/auth
    openssl ecparam -genkey -name prime256v1 -out priv.pem
    openssl pkey -in priv.pem -aes256 -out priv.pem.enc
    nodejs auth-server.js 123456 priv.pem.enc 60000
    ```

- Start Esp server
    ```bash
    cd src/esp
    nodejs esp-server.js [port] [key file password] [key file]
    ```
    Example for generating Auth server key and starting Esp using port 60001
    ```Bash
    cd src/esp
    openssl ecparam -genkey -name prime256v1 -out priv.pem
    openssl pkey -in priv.pem -aes256 -out priv.pem.enc
    nodejs esp-server.js 60001 123456 priv.pem.enc
    ```

- start teller server
    - Generate teller server password config file<br/>
    The password config file is used to instruct the server how to generate
    the aes encryption key in startup

    ```bash
       cd src/teller
       nodejs passwordSetup > [output filename]
    ```
    - Command options for `passwordSetup`:
        - -i [iterations] <br/>
          --iterations=[iterations] iterations is an integer >= 1000 [default: 100000]
        - -k [key length] <br/>
          --keyLen=[key length] key length is 128, 192, or 256 [default: 256]
        - -d [digest algorithm] <br/>
          --digest=[digest algorithm] digest algorithm [default: sha256]
        - -s [salt string] <br/>
          --salt=[salt string] an random string [default: random keylen number of bits encoded in base64]
    - Start a single teller server
    ```bash
    cd src/teller
    nodejs teller-server.js [port] [db schema] [key file password] [password config file] [key file]
    ```
    [db schema] refers to the table to use; currently we have `teller`, `teller2`, `teller3`
    - Example for generating Teller server key and starting 3 Teller using port 50001, 50002, and 50003 on a single server
    ```bash
    cd src/teller
    openssl ecparam -genkey -name prime256v1 -out priv.pem
    openssl pkey -in priv.pem -aes256 -out priv.pem.enc
    nodejs passwordSetup > priv.conf
    nodejs teller-server.js 50001 teller 123456 priv.conf priv.pem.enc
    nodejs teller-server.js 50002 teller2 123456 priv.conf priv.pem.enc
    nodejs teller-server.js 50003 teller3 123456 priv.conf priv.pem.enc
    ```

## Simulate an election
- Run election
    Visit the website `http://localhost:60001` and click the button
    `Create Election` to run a new election.

    Each step can be found in directory `doc_simulate_election`.

    1. create election
    2. freeze election
    3. teller registration (teller url [protocol]//[domain]:[port])
        protocol: http: | https:
        domain: ip address or domain
        port: optional for http/https
    4. freeze tellers
    5. register voters [each line is an email address]
    6. freeze voters
    7. open election
    8. vote
        a. Type email address to give vote link.
        b. If you cannot get the link, add 'console.log(link);' after line 83 in file
        src/auth/sendVoteLink.js. This is because email server may block certain
        IP address. The edu IP address which started with 128.*.*.* should work.
        c. Use the vote link to vote
    9. close election on election admin page
    10. Download ballot file from the election website. The summation file
        can be downloaded after Tallying on ESP.

- Tallying on each teller
    - Tellering script<br/>
    The script will add up will look up the ballot file add up all shares
    submitted to the server. The result will submitted to the ESP afterwards.
    ```Bash
    cd src/teller
    nodejs electionTallying.js [election id] [ballot file] [db schema] [key file password] [password config file] [key file] [teller index]
    ```
    Note: The password should be the same password used for key file.
    Ballot file can be download after election closed via button 'Dump Votes'.
    - Example of tallying on 3 teller servers running on one machine. election id
    `3`, ballot file `/tmp/election_3_ballots.csv` download from election
    website.
    ```bash
    cd src/teller
    nodejs electionTallying.js 3 /tmp/election_3_ballots.csv teller 123456 priv.conf priv.pem.enc 0
    nodejs electionTallying.js 3 /tmp/election_3_ballots.csv teller2 123456 priv.conf priv.pem.enc 1
    nodejs electionTallying.js 3 /tmp/election_3_ballots.csv teller3 123456 priv.conf priv.pem.enc 2
    ```

- Tallying on ESP
    - Tallying script<br/>
    The script will verify the result received from each teller server and publish the final summation.
    ```bash
    cd src/esp
    nodejs finallyTallying.js [election id] [ballot file]
    ```
    - Example of publish the result of election 3.
    ```bash
    cd src/esp
    nodejs finallyTallying.js 3 /tmp/election_3_ballots.csv
    ```

- Third party voting verification
    ```bash
    cd src/common
    nodejs offlineVerify.js [ballot file] [summation file] [report interval (ms) optional]
    ```
    - Command options
        - [ballot file] is a file containing all accepted bullets for one election
        - [summation file] is a file containing the election information and summation result, which can be download after final tallying via button 'Dump Summation'
        - [report interval (ms) optional] is a time interval to report how many bullets are proofed, default is 3000ms
    - Example of verifying election 3 offline
    ```bash
    cd src/common
    nodejs offlineVerify.js /tmp/election_3_ballots.csv /tmp/election_3_summation.json
    ```

## Simulate large population voting by using autoscript
The source code is located at `src/autoscript`.

To use autoscript, you should rewrite the `src/autoscript/dbConfig.js` according to the `dbConfig.tmpl.js`

- generateVoters.js

    Automatically generate a list of voters for the election
    ```bash
    nodejs generateVoters.js [start voter id] [length]
    ```
    Example of generating 1000 voters.
    ```bash
    nodejs generateVoters.js 0 1000 > /tmp/voters.csv
    ```

- loadVoters.js

    automatically loading a list of emails into the database,
    which are the identities of voters. This step should run right
    after step 5 (register voters).
    ```bash
    nodejs loadVoters.js [election id] [email list file] [Auth startup password] [Auth  priv key file]
    ```
    Example of loading 1000 voters (voter id from 0 to 999) for election 3
    ```bash
    cd src/auth
    nodejs loadVoters.js 3 /tmp/voters.csv 123456 ../auth/priv.pem.enc
    ```
    You should

- dumpVoters.js

    dump a list of voterf from the auth servers which will be used for
    `autovote.js`
    ```bash
    nodejs dumpVoters.js [election id] [output filename]
    ```
    Example of dumping voters for election 3
    ```bash
    nodejs dumpVoters.js 3 /tmp/voters_dump.csv
    ```

- autovote.js

    run the automatic voting process. This step should run right
    after step 7 (open election).
    `nodejs autovote.js [election id] [voter ID file] [hostname of authority] [port]`
    ```bash
    nodejs autovote.js [election id] [ESP server url] [dumped voter file]
    ```
    Example of auto voting for election 3
    ```bash
    nodejs autovote.js 3 http://localhost:60001 /tmp/voters_dump.csv
    ```


## Stunnel
- first, build stunnel
    ```bash
    cd stunnel-oqs
    ./build-stunnel.sh
    ```
- then run stunnel with the server side configuration file (`stunnel-localhost-servers-demo.conf`)
    - if one runs the server apps on different machines, each should get a separate configuration file
    ```bash
    cd stunnel-oqs
    ./stunnel-5.40-oqs-build/bin/stunnel ./stunnel-localhost-servers-demo.conf
    ```
- expected default ports of server apps:
    - Auth (app port-60000)
    - Teller-1 (app port-50001)
    - Teller-2 (app port-50002)
    - Teller-3 (app port-50003)
    - ESP (app port-60001)
- default stunnel port:
    - Auth (stunnel port-40000)
    - Teller-1 (stunnel port-40001)
    - Teller-2 (stunnel port-40002)
    - Teller-3 (stunnel port-40003)
    - ESP (stunnel port-40004)
- other pre-requisite for **client** :
    - https://pypi.python.org/pypi/port-for/
    - You should be able to install this easily through pip, e.g. `sudo pip install port-for`

- submit vote through stunnel (client)
    The script `provisioner.py` will read an configuration file and launch
    a firefox which will show a voting page.
    ```bash
    ./stunnel-oqs/provisioner.py http(s)://[host]:[port]/electionapi/[election id] [voting link]
    ```
    Example of run stunnel client. Remember to add quote to the url in order to
    let the shell to treat it as an single argument.
    ```Bash
    ./stunnel-oqs/provisioner.py "http://localhost:60001/electionapi/5" "http://localhost:60001/election/5/vote?email=user1%40example.com&rid=DcRKuZnS_Wpg3uStOSi4-AnYloVJR46YinKQTCmK9_E&reg_time=1567361450.005&link_time=1567364185.5&link_sign=MEQCIGmd9eZkRynZ%2Bv1hOpjHeCa44EBjIX93itwVKtpkpoogAiBPVXaPHgwcLUcbGCSgUvO0SDhsMYEFfb7ktEbZkBgc1g%3D%3D"
    ```

For more details regarding stunnel, please read the readme file under
directory `stunnel-oqs`.
