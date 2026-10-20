import { expect,test } from 'vitest';
import { PROJECT } from '../phase-b/helpers.js';
import { parseFeed,parseHtml } from '../../packages/v3/src/intelligence/parsers.js';
import { Selection } from '../../packages/v3/src/intelligence/model.js';

test('installed parser-only workers preserve publication metadata without network or credentials',()=>{
  const feed=parseFeed(PROJECT,'<rss version="2.0"><channel><title>SYNTHETIC</title><link>https://example.org/</link><description>Fixture</description><item><title>SYNTHETIC receipt</title><link>https://example.org/item</link><pubDate>Mon, 19 Oct 2026 12:00:00 GMT</pubDate><description>Fixture scope</description></item></channel></rss>');
  expect(feed.items[0]).toMatchObject({title:'SYNTHETIC receipt',publishedAt:'2026-10-19T12:00:00Z'});
  expect(feed.networkRequests).toBe(0);expect(feed.credentialsRead).toBe(false);
  expect(parseHtml(PROJECT,'<html><title>SYNTHETIC</title><body><p>Reviewed fixture text.</p><script>fetch("https://example.org")</script></body></html>').paragraphs).toEqual(['Reviewed fixture text.']);
});
test('XML entities and model-added factual prose are rejected before drafting',()=>{
  expect(()=>parseFeed(PROJECT,'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss>&x;</rss>')).toThrow();
  const choice={claimIndices:[0],text:'Unsupported shipped feature.'};
  expect(()=>Selection.parse({posts:Array.from({length:5},()=>choice),threads:[{claimIndices:[0]},{claimIndices:[0]}]})).toThrow();
});
