#!/usr/bin/env bash
cd ../node_modules/sjcl
./configure --with-ecc --with-cbc --compress=none
make