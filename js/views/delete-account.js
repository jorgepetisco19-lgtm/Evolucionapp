// Ventana «Borrar mi cuenta y mis datos» (v17): explica qué se pierde y exige escribir una palabra para confirmar.
import { html, openModal, toast, fail } from '../util.js';
import { t, getLang } from '../i18n.js';
import { deleteAccount, confirmMatches, needsSql, CONFIRM_WORD } from '../account.js';

export function openDeleteAccount({ onExport } = {}) {
  const word = CONFIRM_WORD[getLang()] || CONFIRM_WORD.es;
  const m = openModal(html`
    <form id="del-form" autocomplete="off">
      <p class="note warn"><strong>${t('acct.warn')}</strong></p>
      <p class="small">${t('acct.what')}</p>
      ${onExport ? html`<p class="small"><button type="button" class="btn-link" id="del-export">${t('acct.exportFirst')}</button></p>` : ''}
      <label class="field"><span>${t('acct.type', { word })}</span>
        <input type="text" name="word" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="${word}"></label>
      <p class="error-text small" id="del-err" hidden></p>
      <div class="form-actions">
        <button type="button" class="btn" data-close>${t('common.cancel')}</button>
        <button type="submit" class="btn danger" id="del-go" disabled>${t('acct.confirm')}</button>
      </div>
    </form>`, { title: t('acct.title') });
  const form = m.body.querySelector('#del-form');
  const go = m.body.querySelector('#del-go');
  const err = m.body.querySelector('#del-err');
  form.word.addEventListener('input', () => { go.disabled = !confirmMatches(form.word.value, getLang()); });
  const ex = m.body.querySelector('#del-export');
  if (ex) ex.onclick = () => { m.close(); onExport(); };
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (!confirmMatches(form.word.value, getLang())) return;
    go.disabled = true; form.word.disabled = true; go.textContent = t('acct.deleting');
    err.hidden = true;
    try {
      await deleteAccount();
      m.close();
      toast(t('acct.done'));
    } catch (ex2) {
      console.error(ex2);
      go.disabled = false; form.word.disabled = false; go.textContent = t('acct.confirm');
      if (needsSql(ex2)) { err.textContent = t('acct.needSql'); err.hidden = false; } else fail(ex2);
    }
  };
  return m;
}
