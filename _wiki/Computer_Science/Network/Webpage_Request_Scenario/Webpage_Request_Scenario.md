---
tags: [computer science, network]
---

# WebPage Request Scenario

## End-to-End Journey of a Web Request
A student attaches a laptop to a campus network (LAN) and accesses google.com.

## Step 1: Obtaining an IP Address
### Need for IP Address
1. Need IP address  
    * Manual configuration  
    * Automatic configuration (DHCP)  
    * Get laptop's own IP, first-hop router(gateway)'s address, DNS server's address  

### DHCP Request and Broadcast
2. DHCP request encapsulated in UDP, encapsulated in IP, encapsulated in 802.3 Ethernet (LAN).  
3. Ethernet frame broadcast (destination: FFFFFFFFFFFF) on Local Area Network, received at router running DHCP server.  
4. Ethernet demuxed to IP demuxed, UDP demuxed to DHCP.  

### Receiving DHCP Response
5. DHCP server formulates DHCP ACK containing client's IP address, IP address of first-hop router for client, name and IP address of DNS server.  
6. Encapsulation at DHCP server, frame forwarded (switch learning) through LAN, demultiplexing at client.  
7. DHCP client receives DHCP ACK reply.  
    * Client now has  
        * its own IP address  
    * Client knows  
        * name and address of DNS server  
        * IP address of first-hop router  

## Step 2: Resolving google.com via DNS
### DNS Query Creation
8. Before sending HTTP request, need IP address of google.com  
    * DNS를 통해 가져올 수 있음  

### ARP for Router MAC Address
9. DNS query created, encapsulated in UDP, encapsulated in IP, encapsulated in Ethernet. To send frame to router, need MAC address of router interface.  
    * ARP를 통해 얻을 수 있음  
    * ARP를 통해 router의 IP를 router의 MAC으로 translate  

10. ARP (Address Resolution Protocol) query broadcast, received by router, which replies with ARP reply giving MAC of router interface.  
    * Client knows MAC of first-hop router, so can now send frame containing DNS query.  

### DNS Query Transmission and Response
11. IP datagram containing DNS query forwarded via LAN switch from client to first-hop router.  
12. IP datagram forwarded from campus network into ISP network (Tables created by RIP, OSPF, IS-IS and/or BGP routing protocols) routed to DNS server.  
13. Demuxed to DNS server.  
14. DNS server replies to client with IP of www.google.com  

## Step 3: Sending and Receiving the HTTP Request
### TCP Handshake
15. To send HTTP request, client first opens TCP socket to Web server.  
16. TCP SYN segment inter-domain routed to Web server (step 1 in 3-way handshake).  
17. Web server responds with TCP SYNACK (step 2 in 3-way handshake).  
18. TCP connection established (between your TCP stack and server's TCP stack).  

### HTTP Communication
19. HTTP request sent into TCP socket.  
20. IP datagram containing HTTP request routed to www.google.com  
21. Web server responds with HTTP reply containing web page.  
22. IP datagram containing HTTP reply routed back to client  

## Conclusion
The web page is finally displayed.

