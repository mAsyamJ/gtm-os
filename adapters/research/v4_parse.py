"""Parser-only use of installed Agent Reach RSS and Scrapling components.

No upstream CLI/config bootstrap, credential discovery, fetcher, or model calls.
"""
import json
import socket
import sys
import time

def deny(*args, **kwargs):
    raise PermissionError('Parser worker network prohibited')

class OfflineSocket(socket.socket):
    connect=deny
    connect_ex=deny
    sendto=deny

socket.socket=OfflineSocket
socket.create_connection=deny
socket.getaddrinfo=deny
raw=sys.stdin.read(2*1024*1024+1)
if len(raw.encode())>2*1024*1024:
    raise ValueError('Parser input too large')
if sys.argv[1]=='html':
    from scrapling.parser import Selector
    page=Selector(raw)
    value={'title':page.css('title::text').get(),'paragraphs':page.css('p::text').getall(),
           'networkRequests':0,'credentialsRead':False,'component':'SCRAPLING_SELECTOR_ONLY'}
elif sys.argv[1]=='rss':
    import feedparser
    if '<!DOCTYPE' in raw.upper() or '<!ENTITY' in raw.upper():
        raise ValueError('XML entity/doctype denied')
    parsed=feedparser.parse(raw)
    if parsed.bozo:
        raise ValueError('Malformed feed')
    value={'items':[{'title':entry.get('title',''),'uri':entry.get('link'),
                    'author':entry.get('author'),'summary':entry.get('summary',''),
                    'publishedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',entry.published_parsed) if entry.get('published_parsed') else None}
                    for entry in parsed.entries[:30]],'networkRequests':0,'credentialsRead':False,'component':'AGENT_REACH_PRESCRIBED_FEEDPARSER_ONLY'}
else:
    raise ValueError('Unknown parser mode')
print(json.dumps(value))
