mkdir -p dist/common
browserify src/common/common.js --standalone Common -o dist/common/common.js
