#!/bin/bash

SSL_SRC_DIR='oqs-openssl-1.0.2'
SSL_BUILD_DIR='oqs-openssl-1.0.2-build'

STUNNEL_SRC_DIR='stunnel-5.40'
STUNNEL_BUILD_DIR='stunnel-5.40-oqs-build'

# clean up
(set -x; rm -rf $SSL_BUILD_DIR $STUNNEL_BUILD_DIR)
echo "==> clean up done"

# create build folders
(set -x; mkdir -p $SSL_BUILD_DIR $STUNNEL_BUILD_DIR)

# build OpenSSL 1.0.2
cd $SSL_SRC_DIR
(set -x; make clean; rm -f Makefile; ./config -fPIC --openssldir=`pwd`/../$SSL_BUILD_DIR)
make depend
make -j 2
make install
echo "==> OQS OpenSSL successfully built in $SSL_BUILD_DIR"
cd ..

# build STunnel
cd $STUNNEL_SRC_DIR
make clean; rm -f Makefile
# this is necessary to avoid a bug with aclocal, since we modified the source
touch configure.ac aclocal.m4 configure Makefile.am Makefile.in
# refresh the checked-in dhparam.c
touch ./src/dhparam.c
./configure --with-ssl=`pwd`/../$SSL_BUILD_DIR --prefix=`pwd`/../$STUNNEL_BUILD_DIR --exec-prefix=`pwd`/../$STUNNEL_BUILD_DIR
make -j 2
make install
echo "==> OQS STunnel successfully built in $STUNNEL_BUILD_DIR"
