/* Pure voice text normalization. Preserve historical ASR behavior. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CadVoiceText = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function normalize(text) {
    return String(text).toLowerCase()
      .replace(/\bbatallion\b/g, 'battalion')
      // Browser and hosted ASR often hear the law-enforcement phonetic Adam as Atom.
      .replace(/\b(?:atom|addam)\b/g, 'adam')
      // Only interpret 'item' as Adam between a radio prefix and unit number.
      .replace(/\b(\d+|one|two|three|four|five|six|seven|eight|nine)\s+item\s+(?=\d+|one\b|two\b|three\b|four\b|five\b|six\b|seven\b|eight\b|nine\b|ten\b|eleven\b|twelve\b|thirteen\b|fourteen\b|fifteen\b|sixteen\b|seventeen\b|eighteen\b|nineteen\b|twenty\b|thirty\b|forty\b|fifty\b)/g, '$1 adam ')
      .replace(/[-_.,!?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // APCO-style public safety phonetics, plus common NATO alternatives and
  // narrowly scoped speech-recognition substitutions. No fuzzy guessing.
  const phonetics = Object.freeze({
    A:['adam','alpha','atom','addam','item'],
    B:['boy','bravo'], C:['charles','charlie'], D:['david','delta'],
    E:['edward','echo'], F:['frank','foxtrot'], G:['george','golf'],
    H:['henry','hotel'], I:['ida','india'], J:['john','juliet','juliett'],
    K:['king','kilo'], L:['lincoln','lima'], M:['mary','mike'],
    N:['nora','november'], O:['ocean','oscar'], P:['paul','papa'],
    Q:['queen','quebec'], R:['robert','romeo'], S:['sam','sierra'],
    T:['tom','tango'], U:['union','uniform'], V:['victor','victoria'],
    W:['william','whiskey'], X:['xray','x-ray','x ray'],
    Y:['young','yankee'], Z:['zebra','zulu']
  });
  const nameToLetter = {};
  for (const [letter,names] of Object.entries(phonetics)) {
    nameToLetter[letter.toLowerCase()]=letter;
    for (const name of names) nameToLetter[name.replace(/[ -]/g,'')]=letter;
  }
  const digits={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,
    ten:10,eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
    seventeen:17,eighteen:18,nineteen:19,twenty:20,thirty:30,forty:40,fifty:50,
    sixty:60,seventy:70,eighty:80,ninety:90};
  function numberAt(words,i) {
    const first=String(words[i]||'').replace(/['’]s$/,'').replace(/\b(thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)s$/,'$1');
    if (/^\d{1,3}$/.test(first||'')) return {value:Number(first),length:1};
    if (!Object.hasOwn(digits,first))return null;
    let value=digits[first],length=1;
    if(value>=20&&value%10===0 && words[i+1] && Object.hasOwn(digits,words[i+1]) && digits[words[i+1]]>0 && digits[words[i+1]]<10){
      value+=digits[words[i+1]];length=2;
    }
    return {value,length};
  }
  function numericCallsigns(text) {
    // Interpret phonetics only inside full prefix + phonetic + suffix patterns.
    // The returned IDs are candidates; callers MUST require exact roster matches.
    const normalized=normalize(text).replace(/(\d)([a-z]{2,})(?=\d)/g,'$1 $2 ')
      .replace(/(\d)([a-z]{2,})\s+(?=\d)/g,'$1 $2 ')
      .replace(/\bx[ -]?ray\b/g,'xray');
    const words=normalized.split(/\s+/).filter(Boolean),ids=[];
    for(let i=0;i<words.length;i++){
      const left=numberAt(words,i);
      if(!left||left.value<1||left.value>99)continue;
      const middle=i+left.length;
      const letter=nameToLetter[words[middle]];
      if(!letter)continue;
      const right=numberAt(words,middle+1);
      if(!right||right.value<0||right.value>999)continue;
      // "item" is an ASR repair ONLY when framed by numeric unit components.
      const id=left.value+letter+right.value;
      if(!ids.includes(id))ids.push(id);
    }
    // Explicit alphanumeric identifiers also work without spoken phonetics.
    for(const match of normalized.matchAll(/\b(\d{1,2})([a-z])(\d{1,3})\b/g)){
      const id=Number(match[1])+match[2].toUpperCase()+Number(match[3]);
      if(!ids.includes(id))ids.push(id);
    }
    return ids;
  }

  return Object.freeze({ normalize, phonetics, numericCallsigns });
});
