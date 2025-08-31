<script>
const ENDPOINT = 'InventorymanagementProject_Nobab_06/backend/api.php'
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))
const sleep = (ms) => new Promise(r => setTimeout(r, ms))
const nowIso = () => new Date().toISOString()
const CACHE_BUST = true

function toast(msg, type = 'info') {
  let bar = $('#mini-toast')
  if (!bar) {
    bar = document.createElement('div')
    bar.id = 'mini-toast'
    bar.style.position = 'fixed'
    bar.style.right = '12px'
    bar.style.bottom = '12px'
    bar.style.padding = '8px 12px'
    bar.style.borderRadius = '6px'
    bar.style.background = '#111'
    bar.style.color = '#fff'
    bar.style.fontSize = '12px'
    bar.style.boxShadow = '0 6px 18px rgba(0,0,0,.25)'
    bar.style.zIndex = '99999'
    document.body.appendChild(bar)
  }
  bar.textContent = msg
  bar.style.background = type === 'error' ? '#b00020' : type === 'success' ? '#065f46' : '#111'
  bar.style.opacity = '1'
  setTimeout(() => { bar.style.transition = 'opacity .4s'; bar.style.opacity = '0' }, 2200)
}

async function apiRequest(entity, method = 'GET', data = null, id = null, extraQuery = {}) {
  const url = new URL(ENDPOINT, window.location.href)
  url.searchParams.set('entity', entity)
  if (id != null) url.searchParams.set('id', id)
  for (const [k, v] of Object.entries(extraQuery || {})) url.searchParams.set(k, v)
  if (CACHE_BUST) url.searchParams.set('_t', Date.now().toString())
  const hasBody = data != null && method !== 'GET'
  const fetchOpts = {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(data) : undefined,
  }
  let res
  try {
    res = await fetch(url.toString(), fetchOpts)
  } catch (networkErr) {
    toast('Network error', 'error')
    throw networkErr
  }
  const text = await res.text()
  const tryJson = () => { try { return JSON.parse(text) } catch { return text } }
  if (!res.ok) {
    const msg = typeof tryJson() === 'string' ? tryJson() : (tryJson().message || 'Request failed')
    toast(msg, 'error')
    throw new Error(msg)
  }
  return typeof tryJson() === 'string' ? { message: tryJson() } : tryJson()
}

function serializeForm(modalEl) {
  const fields = $$('input, select, textarea', modalEl)
  const payload = {}
  for (const el of fields) {
    const key = (el.getAttribute('name') || el.getAttribute('placeholder') || '')
      .trim().toLowerCase().replace(/\s+/g, '_')
    if (!key) continue
    let val = (el.value ?? '').trim()
    if (el.type === 'number' && val !== '') {
      const n = Number(val)
      if (!Number.isNaN(n)) val = n
    }
    payload[key] = val
  }
  return payload
}

function fillTable(tbody, rows, columns) {
  tbody.innerHTML = ''
  const frag = document.createDocumentFragment()
  if (!Array.isArray(rows) || rows.length === 0) {
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = columns.length + 1
    td.textContent = 'No data found'
    td.style.opacity = '0.7'
    tr.appendChild(td)
    frag.appendChild(tr)
  } else {
    for (const r of rows) {
      const tr = document.createElement('tr')
      tr.dataset.id = r.id
      for (const c of columns) {
        const td = document.createElement('td')
        td.textContent = r[c] ?? ''
        tr.appendChild(td)
      }
      const actions = document.createElement('td')
      actions.innerHTML = `
        <button class="btn btn-warning btn-sm me-1 btn-edit" data-action="edit">Edit</button>
        <button class="btn btn-danger btn-sm btn-delete" data-action="delete">Delete</button>`
      tr.appendChild(actions)
      frag.appendChild(tr)
    }
  }
  tbody.appendChild(frag)
}

function showLoadingRow(tbody, colCount) {
  const tr = document.createElement('tr')
  const td = document.createElement('td')
  td.colSpan = colCount + 1
  td.textContent = 'Loading...'
  td.style.opacity = '0.7'
  tr.appendChild(td)
  tbody.innerHTML = ''
  tbody.appendChild(tr)
}

const PAGES = [
  { match: 'inventory.html', entity: 'inventory', columns: ['product_id','product_name','category','stock_level','usage_rate','quantity','procurement_schedule'] },
  { match: 'agricultural_products.html', entity: 'agricultural_products', columns: ['product_id','product_name','category','seed_type','sowing_date','expected_harvest','storage','shelf_life','packaging'] },
  { match: 'harvested_crops.html', entity: 'harvested_crops', columns: ['crop_id','temperature','humidity','category','harvest_date','crop_name','quantity','storage','processing_unit'] },
  { match: 'perishable_products.html', entity: 'perishable_products', columns: ['product_id','product_name','storage','product_type','category','expiry_date'] },
  { match: 'post_harvest.html', entity: 'post_harvest', columns: ['product_id','product_name','category','batch_number','expiry_date','storage_condition','location','quantity','stock_level_status'] },
  { match: 'storage_condition.html', entity: 'storage_conditions', columns: ['warehouse_id','location','temperature','humidity'] },
]

function hydrateEditModalFromRow(editModal, row, columns) {
  const cells = row.querySelectorAll('td')
  const inputs = $$('input, select, textarea', editModal)
  editModal.dataset.id = row.dataset.id
  for (let i = 0; i < columns.length; i++) {
    if (!inputs[i]) continue
    inputs[i].value = cells[i]?.innerText ?? ''
  }
}

async function reloadTable(tbody, entity, columns) {
  showLoadingRow(tbody, columns.length)
  try {
    const rows = await apiRequest(entity)
    sessionStorage.setItem(`cache:${entity}`, JSON.stringify({ at: nowIso(), rows }))
    fillTable(tbody, rows, columns)
  } catch (e) {
    const cached = sessionStorage.getItem(`cache:${entity}`)
    if (cached) {
      const { rows } = JSON.parse(cached)
      fillTable(tbody, rows, columns)
      toast('Showing cached data (offline)', 'info')
    } else {
      fillTable(tbody, [], columns)
    }
  }
}

async function withPending(btn, fn) {
  if (!btn) return fn()
  const original = btn.innerHTML
  btn.disabled = true
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Saving'
  try { return await fn() }
  finally { btn.disabled = false; btn.innerHTML = original }
}

function wirePage({ entity, columns }) {
  const tbody = document.querySelector('tbody')
  const addModal = $('#addModal')
  const editModal = $('#editModal')
  const cached = sessionStorage.getItem(`cache:${entity}`)
  if (cached) {
    try {
      const { rows } = JSON.parse(cached)
      fillTable(tbody, rows, columns)
    } catch {}
  } else {
    showLoadingRow(tbody, columns.length)
  }
  reloadTable(tbody, entity, columns)
  const addBtn = addModal?.querySelector('.btn.btn-success')
  addBtn?.addEventListener('click', async () => {
    await withPending(addBtn, async () => {
      const payload = serializeForm(addModal)
      await apiRequest(entity, 'POST', payload)
      toast('Added successfully', 'success')
      await reloadTable(tbody, entity, columns)
      $$('input, select, textarea', addModal).forEach(i => (i.value = ''))
    })
  })
  const saveBtn = editModal?.querySelector('.btn.btn-warning')
  saveBtn?.addEventListener('click', async () => {
    const id = editModal?.dataset.id
    if (!id) return toast('No row selected', 'error')
    await withPending(saveBtn, async () => {
      const payload = serializeForm(editModal)
      await apiRequest(entity, 'PUT', payload, id)
      toast('Updated successfully', 'success')
      await reloadTable(tbody, entity, columns)
    })
  })
  tbody?.addEventListener('click', async (e) => {
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    const row = target.closest('tr')
    if (!row) return
    const id = row.dataset.id
    if (target.classList.contains('btn-delete') || target.dataset.action === 'delete') {
      const originalHTML = row.innerHTML
      row.innerHTML = `<td colspan="${columns.length + 1}">Deleting...</td>`
      try {
        await apiRequest(entity, 'DELETE', null, id)
        toast('Deleted', 'success')
        await reloadTable(tbody, entity, columns)
      } catch (err) {
        row.innerHTML = originalHTML
      }
    }
    if (target.classList.contains('btn-edit') || target.dataset.action === 'edit') {
      hydrateEditModalFromRow(editModal, row, columns)
    }
  })
  ;[addModal, editModal].forEach(modal => {
    modal?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault()
        (modal.querySelector('.btn.btn-success, .btn.btn-warning'))?.click()
      }
    })
  })
}

document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname
  const match = PAGES.find(p => path.endsWith(p.match))
  if (match) wirePage(match)
})
</script>
