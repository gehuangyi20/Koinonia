#!/usr/bin/env python

"""
a HTTP Proxy server implementation in Python
"""

from BaseHTTPServer import BaseHTTPRequestHandler
from StringIO import StringIO
import thread
import sys
import socket
import port_for
from datetime import datetime
import select

class HTTPRequest(BaseHTTPRequestHandler):
    def __init__(self, request_text):
        self.rfile = StringIO(request_text)
        self.raw_requestline = self.rfile.readline()
        self.error_code = self.error_message = None
        self.parse_request()

    def send_error(self, code, message):
        self.error_code = code
        self.error_message = message

def startProxyServer(port, backlog, buf_size, remote_addrs=(), local_tunnel_ports=()):
    """Start a server to listen for incoming connections"""
    try:
        # create socket, bind and listen
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        print "[*] Socket created"
        s.bind(('', port))
        print "[*] Socket binded to port {} successfully".format(port)
        s.listen(backlog)
        print "[*] Server started listening ..."
    except Exception as e:
        print "[*] Error: Server failed to start"
        print "\t Exception {}".format(e)
        sys.exit(1)

    # now we can have the main loop
    while True:
        try:
            conn, addr = s.accept()
            data = conn.recv(buf_size)

            print "[*] len(data) = {}".format(len(data))
            thread.start_new_thread(clientHandler, 
                                    (conn, data, addr, buf_size, remote_addrs, local_tunnel_ports))
        except KeyboardInterrupt:
            print "[*] Keyboard Interrupt Caught"
            print "[*] Closing Proxy Server ..."            
            s.close()
            raise

def dataRelay(server_addr, server_port, client_conn, client_req, buffer_size):
    """Connect to remote server and relay data back to client"""
    try:
        RECV_TIMEOUT = 350
        webserv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        webserv.connect((server_addr, server_port))
        webserv.send(client_req)

        webserv.setblocking(0)

        while 1:
            print "[!] try webserv.recv at "+datetime.now().strftime('%y-%b-%d %H:%M:%S')
            # webserv.settimeout(RECV_TIMEOUT)
            # response = webserv.recv(buffer_size)
            ready = select.select([webserv], [], [], RECV_TIMEOUT)
            if ready[0]:
                response = webserv.recv(buffer_size)  
                RECV_TIMEOUT = 3.5          
            else:
                break
            if len(response) > 0:
                client_conn.send(response)
                print "[*] %.5s KB Responses from %s:%s sent to client" % (float(len(response)) / 1024, server_addr, server_port)
            else:
                # stop the loop with no more data to relay
                break

        print "[!] nothing more to receive from {}:{} at ".format(server_addr, server_port)+datetime.now().strftime('%y-%b-%d %H:%M:%S')
        
        # now we can close the sockets
        webserv.shutdown(socket.SHUT_RDWR)
        webserv.close()
        client_conn.shutdown(socket.SHUT_RDWR)
        client_conn.close()
    except socket.error, (value, message):
        print "[!] socket error, will close both directions"
        webserv.shutdown(socket.SHUT_RDWR)
        webserv.close()
        client_conn.shutdown(socket.SHUT_RDWR)
        client_conn.close()


def clientHandler(conn, data, addr, buf_size, remote_addrs, local_tunnel_ports):
    """
    Handle an incoming client connection, and
    inspect the first line of HTTP header to determine which host to talk to
    """
    try:
        request = HTTPRequest(data)
        if request.error_code is None:
            url = request.path
            http_pos = url.find('://')
            if http_pos == -1: # protocol prefix not
                temp = url # use the whole path
            else:
                temp = url[(http_pos+3):] # use only the remaining portion
            port_pos = temp.find(':')
            webserver_pos = temp.find('/')
            if webserver_pos == -1: # slash not found
                webserver_pos = len(temp) # use the whole thing
            webserver = ""
            port = -1
            if port_pos == -1 or webserver_pos < port_pos: # port number not specified
                port = 80 # use default port
                webserver = temp[:webserver_pos]
            else:
                port = int((temp[(port_pos+1):])[:webserver_pos-port_pos-1])
                webserver = temp[:port_pos]

        remote = "{}:{}".format(webserver, port)
        print "remote = {}".format(remote)
        print "remote_addrs = {}".format(remote_addrs)
        # now we know which remote to talk to
        # the local port matching logic

        if remote in remote_addrs: # found in the known tuple of remotes
            local_port = local_tunnel_ports[remote_addrs.index(remote)]
            print "[*] {} recognized, fwd to localhost:{}".format(remote, local_port)
            dataRelay("127.0.0.1", 
                      local_port, # relay with the local tunnel port
                      conn, data, buf_size) 
        else: # not found in the known tuple of remotes
            print "[*] {} not recognized, do simple relay".format(remote)
            dataRelay(webserver, port, conn, data, buf_size) # do simple relaying

    except Exception, e:
        pass

if __name__ == "__main__":
    try:
        listening_port = port_for.select_random()
        max_conn = 1024
        buffer_size = 8192

        startProxyServer(listening_port, max_conn, buffer_size, ('www.example.com:80',), (8000,))
    except KeyboardInterrupt:
        print "[*] Normal exit now"
        sys.exit(0)
