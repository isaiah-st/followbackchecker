// The page: takes the dropped files, shows the three lists, handles search, sort and copy.
// Nothing is stored: refresh the page and it's all gone.

var LISTS = {
  notBack: { note: 'You follow them, they don\'t follow you.', when: 'you followed', empty: 'Everyone you follow follows you back.' },
  fans:    { note: 'They follow you, you don\'t follow them.', when: 'followed you', empty: 'You follow back everyone who follows you.' },
  mutuals: { note: 'You follow each other.', when: 'you followed', empty: 'No mutuals yet.' }
};

var result = null;
var current = 'notBack';
var $ = function (id) { return document.getElementById(id); };
var dateFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// ---- bringing files in ----
var drop = $('drop');
$('file').addEventListener('change', function () { load(this.files); this.value = ''; });
['dragenter', 'dragover'].forEach(function (type) {
  drop.addEventListener(type, function (e) { e.preventDefault(); drop.classList.add('over'); });
});
['dragleave', 'drop'].forEach(function (type) {
  drop.addEventListener(type, function () { drop.classList.remove('over'); });
});
drop.addEventListener('drop', function (e) { e.preventDefault(); load(e.dataTransfer.files); });
// a file dropped anywhere else shouldn't make the browser open it
window.addEventListener('dragover', function (e) { e.preventDefault(); });
window.addEventListener('drop', function (e) { e.preventDefault(); });

async function load(files) {
  if (!files || !files.length) return;
  say('Reading ' + (files.length === 1 ? files[0].name : files.length + ' files') + '…');
  try {
    var data = await readFiles(files);
    show(compare(data.followers, data.following), 'from your Instagram export');
  } catch (e) {
    say(e.message, true);
  }
}

// ---- showing results ----
function show(r, source) {
  result = r;
  $('summary').textContent = r.followers + (r.followers === 1 ? ' follower' : ' followers') + ' · ' + r.following + ' following · ' + source;
  Object.keys(LISTS).forEach(function (k) { $('count-' + k).textContent = r[k].length; });
  $('start').hidden = true;
  $('results').hidden = false;
  say('');
  pick('notBack');
  $('results').scrollIntoView({ block: 'start' });
}

document.querySelectorAll('.tabs button').forEach(function (b) {
  b.addEventListener('click', function () { pick(b.dataset.list); });
});
function pick(list) {
  current = list;
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.setAttribute('aria-pressed', b.dataset.list === list);
  });
  $('list-note').textContent = LISTS[list].note;
  render();
}

$('search').addEventListener('input', render);
$('sort').addEventListener('change', render);

function visible() {
  var q = $('search').value.trim().replace(/^@/, '').toLowerCase();
  var rows = result[current].filter(function (u) { return u.username.indexOf(q) !== -1; });
  var sort = $('sort').value;
  rows.sort(function (a, b) {
    if (sort === 'az') return a.username.localeCompare(b.username);
    // entries without a date (hand-made lists) go last either way
    if (a.timestamp == null) return 1;
    if (b.timestamp == null) return -1;
    return sort === 'oldest' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
  });
  return rows;
}

function render() {
  if (!result) return;
  var rows = visible();
  var list = $('list');
  var frag = document.createDocumentFragment();
  rows.forEach(function (u) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = 'https://www.instagram.com/' + encodeURIComponent(u.username) + '/';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = '@' + u.username;   // textContent: a username from a file is never treated as HTML
    li.appendChild(a);
    if (u.timestamp) {
      var when = document.createElement('span');
      when.className = 'when mono muted';
      when.textContent = LISTS[current].when + ' ' + dateFormat.format(new Date(u.timestamp * 1000));
      li.appendChild(when);
    }
    frag.appendChild(li);
  });
  list.replaceChildren(frag);

  var empty = $('empty');
  empty.hidden = rows.length > 0;
  empty.textContent = result[current].length ? 'No usernames match "' + $('search').value.trim() + '".' : LISTS[current].empty;
  $('copy').disabled = rows.length === 0;
}

// ---- copy and reset ----
$('copy').addEventListener('click', function () {
  var names = visible().map(function (u) { return u.username; });
  navigator.clipboard.writeText(names.join('\n')).then(
    function () { say('Copied ' + names.length + ' username' + (names.length === 1 ? '' : 's') + '.'); },
    function () { say('Couldn\'t copy. Your browser blocked clipboard access.', true); }
  );
});

$('reset').addEventListener('click', function () {
  result = null;
  $('list').replaceChildren();
  $('search').value = '';
  $('results').hidden = true;
  $('start').hidden = false;
  say('Cleared. Nothing was kept.');
  $('file').focus();
});

function say(text, isError) {
  var status = $('status');
  status.textContent = text;
  status.classList.toggle('error', !!isError);
}
