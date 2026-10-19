"""Audited, keyless component replays; never bootstrap an upstream skill or load auth."""
import hashlib
import importlib.util
import importlib.metadata
import json
from pathlib import Path
import socket
import sys

ATTEMPTS = 0
def deny(*args, **kwargs):
    global ATTEMPTS
    ATTEMPTS += 1
    raise PermissionError('Offline adapter prohibits network access')

class OfflineSocket(socket.socket):
    connect = deny
    connect_ex = deny
    sendto = deny

def main():
    socket.socket = OfflineSocket
    socket.create_connection = deny
    socket.getaddrinfo = deny
    if len(sys.argv) != 2 or sys.argv[1] not in {'rss', 'dates', 'html'}:
        raise ValueError('Only audited offline rss, dates and html components are available')
    raw = sys.stdin.read(1048577)
    if len(raw.encode()) > 1048576: raise ValueError('Input too large')
    value = json.loads(raw)
    if value.get('tenant') not in {'founder','retropick'}: raise ValueError('Explicit tenant required')
    mode = sys.argv[1]
    result = {'tenant':value['tenant'],'label':'SYNTHETIC','mode':mode,'networkRequests':0,'hostedModelRequests':0,
              'credentialsRead':False,'scope':'OFFLINE_COMPONENT_REPLAY_NOT_LIVE_RETRIEVAL'}
    if mode == 'rss':
        import feedparser
        feed = value['feed']
        if not isinstance(feed,str) or not feed.lstrip().startswith('<') or any(x in feed.upper() for x in ['<!DOCTYPE','<!ENTITY']): raise ValueError('Only inert XML fixtures accepted')
        parsed = feedparser.parse(feed)
        items = {}; result['library'] = 'feedparser '+importlib.metadata.version('feedparser')
        for entry in parsed.entries:
            key = entry.get('id') or entry.get('link') or entry.get('title')
            items.setdefault(key, {'id':key,'title':entry.get('title'),'published':entry.get('published'),'link':entry.get('link')})
        result['items'] = list(items.values())
        result['component'] = 'Agent Reach prescribed RSS parser; broad doctor and credential channels were not invoked'
    elif mode == 'dates':
        path = Path('/home/ubuntu/agent-control-plane/sources/last30days/skills/last30days/scripts/lib/dates.py')
        lock = json.loads((Path(__file__).resolve().parents[2]/'config/v3-research-components.json').read_text())
        if hashlib.sha256(path.read_bytes()).hexdigest() != lock['last30days_dates_sha256']: raise ValueError('Pinned component changed')
        spec = importlib.util.spec_from_file_location('audited_last30days_dates',path)
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        days = value.get('days',30)
        if not isinstance(days,int) or not 1 <= days <= 90: raise ValueError('Invalid date window')
        result['range'] = module.get_date_range(days, value['asOf']); result['component'] = 'Pinned Last30Days date utilities only'
        result['componentSha256'] = lock['last30days_dates_sha256']
    else:
        from scrapling.parser import Selector
        html = value['html']
        if not isinstance(html,str) or '<!ENTITY' in html.upper(): raise ValueError('Invalid HTML fixture')
        selector = Selector(html)
        result.update(title=selector.css('title::text').get(),paragraphs=selector.css('p::text').getall(),
                      library='scrapling '+importlib.metadata.version('scrapling'),component='Existing Scrapling Selector; no Fetcher, browser or stealth mode')
    result['networkRequests'] = ATTEMPTS
    if ATTEMPTS: raise ValueError('Offline component attempted network access')
    print(json.dumps(result,sort_keys=True))

if __name__ == '__main__':
    try: main()
    except Exception:
        print(json.dumps({'status':'BLOCKED','reason':'Offline component absent, changed, invalid or denied','networkRequests':ATTEMPTS}),file=sys.stderr)
        sys.exit(4)
