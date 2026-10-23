// Reading the files people drop in: Instagram's export (.zip or its .json files)
// or plain username lists. Everything here runs in the browser; nothing is sent anywhere.

// ---- a small .zip reader, so the export can be dropped in without unzipping ----
// Uses the browser's built-in DecompressionStream, so there are no libraries to load.
async function readZip(file) {
  var buf = new Uint8Array(await file.arrayBuffer());
  var view = new DataView(buf.buffer);

  // the "end of central directory" record sits at the very end of every zip
  var end = -1;
  for (var i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('That file isn\'t a readable .zip.');
  var count = view.getUint16(end + 10, true);
  var offset = view.getUint32(end + 16, true);
  if (offset === 0xffffffff) {
    throw new Error('This export is too big to read here. Request only "Followers and following" in JSON format, or unzip it and drop in the .json files.');
  }

  var names = new TextDecoder();
  var entries = [];
  for (var n = 0; n < count; n++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    var nameLen = view.getUint16(offset + 28, true);
    var extraLen = view.getUint16(offset + 30, true);
    var commentLen = view.getUint16(offset + 32, true);
    entries.push({
      name: names.decode(buf.subarray(offset + 46, offset + 46 + nameLen)),
      method: view.getUint16(offset + 10, true),
      size: view.getUint32(offset + 20, true),
      local: view.getUint32(offset + 42, true)
    });
    offset += 46 + nameLen + extraLen + commentLen;
  }

  return entries.map(function (e) {
    return {
      name: e.name,
      text: function () {
        // the file's data starts after its own local header
        var start = e.local + 30 + view.getUint16(e.local + 26, true) + view.getUint16(e.local + 28, true);
        var data = buf.subarray(start, start + e.size);
        if (e.method === 0) return Promise.resolve(new TextDecoder().decode(data));
        if (e.method !== 8) return Promise.reject(new Error('Unsupported compression in ' + e.name));
        var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).text();
      }
    };
  });
}

// ---- which file is which ----
// Instagram names them followers_1.json, followers_2.json ... and following.json.
// followers.json also counts, so the old hand-made lists from the template still work.
function kindOf(path) {
  var base = path.split('/').pop().toLowerCase();
  if (/^followers(_\d+)?\.json$/.test(base)) return 'followers';
  if (base === 'following.json') return 'following';
  return null;
}

// ---- turning a file's JSON into [{ username, timestamp }] ----
// Handles every shape seen so far:
//   followers_1.json  [{ string_list_data: [{ href, value, timestamp }] }]
//   following.json    { relationships_following: [{ title, string_list_data: [{ href, timestamp }] }] }
//   template lists    ["username", ...]
function usersFrom(json) {
  var list = Array.isArray(json) ? json
    : json.relationships_following || json.relationships_followers
      || Object.values(json).filter(Array.isArray)[0] || [];
  return list.map(function (item) {
    if (typeof item === 'string') return { username: clean(item), timestamp: null };
    var data = (item.string_list_data || [])[0] || {};
    var fromLink = data.href ? data.href.replace(/\/+$/, '').split('/').pop() : '';
    return { username: clean(data.value || item.title || fromLink), timestamp: data.timestamp || null };
  }).filter(function (u) { return u.username; });
}

// usernames are case-insensitive on Instagram, and hand-made lists can carry stray spaces or an @
function clean(name) {
  return String(name || '').trim().replace(/^@/, '').toLowerCase();
}

// ---- the comparison ----
// Maps keep each username once, with the date that came with it.
function compare(followers, following) {
  var fol = new Map(followers.map(function (u) { return [u.username, u.timestamp]; }));
  var ing = new Map(following.map(function (u) { return [u.username, u.timestamp]; }));
  var notBack = [], fans = [], mutuals = [];
  ing.forEach(function (t, name) {
    (fol.has(name) ? mutuals : notBack).push({ username: name, timestamp: t });
  });
  fol.forEach(function (t, name) {
    if (!ing.has(name)) fans.push({ username: name, timestamp: t });
  });
  return { notBack: notBack, fans: fans, mutuals: mutuals, followers: fol.size, following: ing.size };
}

// ---- reading whatever was dropped in ----
// Returns { followers: [...], following: [...], files: n } or throws a message worth showing.
async function readFiles(fileList) {
  var found = { followers: [], following: [] };
  var used = 0;
  var sawHtml = false;

  async function take(path, getText) {
    var kind = kindOf(path);
    if (!kind) {
      if (/(followers(_\d+)?|following)\.html$/i.test(path)) sawHtml = true;
      return;
    }
    var json;
    try { json = JSON.parse(await getText()); }
    catch (e) { throw new Error(path.split('/').pop() + ' isn\'t valid JSON. If it\'s empty, paste your list in first.'); }
    found[kind] = found[kind].concat(usersFrom(json));
    used++;
  }

  for (var i = 0; i < fileList.length; i++) {
    var file = fileList[i];
    if (/\.zip$/i.test(file.name)) {
      var entries = await readZip(file);
      for (var j = 0; j < entries.length; j++) await take(entries[j].name, entries[j].text);
    } else {
      await take(file.name, file.text.bind(file));
    }
  }

  if (!used && sawHtml) {
    throw new Error('This export is in HTML format. Request it again and choose JSON as the format.');
  }
  if (!found.followers.length && !found.following.length) {
    throw new Error('No followers or following lists found. Drop in the export .zip, or followers_1.json and following.json.');
  }
  if (!found.followers.length) throw new Error('Found your following list but no followers list (followers_1.json).');
  if (!found.following.length) throw new Error('Found your followers list but no following list (following.json).');
  return { followers: found.followers, following: found.following, files: used };
}
