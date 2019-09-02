{
  "targets": [
    {
      "target_name": "nativeEcc",
      "sources": [
        "native/nativeEcc.cc", "native/Elliptic.cc", "native/POINT.cc",
        "native/BN.cc", "native/base64.cc", "native/util.cc" ],
      "include_dirs": ["<!(node -e \"require('nan')\")"]
    }
  ]
}