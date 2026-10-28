import {test} from 'node:test';import assert from 'node:assert/strict';
import {extractJats,extractOfficialHtml,validateFullText} from './corpus-fulltext';
const jats=(license:string)=>`<!DOCTYPE article SYSTEM "https://example.invalid/not-fetched.dtd"><article xml:lang="pt"><front><article-meta><article-id pub-id-type="doi">10.1234/abc</article-id><title-group><article-title>Estudo</article-title></title-group><contrib-group><contrib contrib-type="author"><name><surname>Silva</surname><given-names>Ana</given-names></name></contrib></contrib-group><abstract><p>Resumo</p></abstract><permissions><license xlink:href="${license}"/></permissions></article-meta></front><body><sec><title>Métodos</title><p>Texto integral inicial.</p><table-wrap><table><tr><td>Tabela preservada</td></tr></table></table-wrap><p>Conclusão final além do resumo.</p></sec></body><back><ref-list><ref>Referência bibliográfica</ref></ref-list></back><sub-article><body><p>TRANSLATION</p></body></sub-article></article>`;
test('JATS verifica DOI e CC-BY na fonte e preserva corpo, tabela e referências',()=>{
 const r=extractJats(jats('https://creativecommons.org/licenses/by/4.0/'),'10.1234/ABC');
 assert.match(r.text,/Conclusão final/);assert.match(r.text,/Tabela preservada/);assert.match(r.text,/Referência bibliográfica/);assert.match(r.text,/Ana Silva/);assert.doesNotMatch(r.text,/TRANSLATION/);assert.equal(r.license,'CC-BY-4.0');
 assert.throws(()=>extractJats(jats('https://creativecommons.org/licenses/by-nc/4.0/'),'10.1234/abc'),/licença/);
 assert.throws(()=>extractJats(jats('https://creativecommons.org/licenses/by/4.0/'),'10.1234/outro'),/DOI/);
 assert.throws(()=>extractJats(jats('https://creativecommons.org/licenses/by/4.0/').replace('<body>','<notbody>'),'10.1234/abc'));
});
test('HTML oficial conserva todos os parágrafos, valida início/fim e não aceita CAPTCHA ou truncamento',()=>{
 const text=extractOfficialHtml('<html><body><p>Art. 1º Introdução.</p><p>Art. 65. Disposição final.</p><script>ruído</script></body></html>');
 assert.match(text,/Art. 65/);assert.doesNotMatch(text,/ruído/);
 assert.doesNotThrow(()=>validateFullText(text,{minChars:30,required:['Art. 1','Art. 65']}));
 assert.throws(()=>validateFullText(text,{minChars:30,required:['Art. 193']}));
 assert.throws(()=>extractOfficialHtml('<html><title>Verificação de segurança</title><body>captcha</body></html>'));
});
test('JATS não admite entidades personalizadas e não aceita resumo sem corpo',()=>{
 assert.throws(()=>extractJats('<!ENTITY x SYSTEM "file:///segredo">'+jats('https://creativecommons.org/licenses/by/4.0/'),'10.1234/abc'),/Entidade/);
 assert.throws(()=>extractJats(jats('https://creativecommons.org/licenses/by/4.0/').replace(/<body>[\s\S]*?<\/body>/,''),'10.1234/abc'),/integral/);
});
test('células JATS mantêm separadores e não alteram os números das tabelas',()=>{
 const xml=jats('https://creativecommons.org/licenses/by/4.0/').replace('<td>Tabela preservada</td>','<th>Grupo A</th><td>12</td><td>34</td>');
 assert.match(extractJats(xml,'10.1234/abc').text,/Grupo A \| 12 \| 34/);
});
