import { useState } from 'react'
import { getAccessToken, backupToDrive, restoreFromDrive } from '../lib/googleDrive'
import { exportAllData, importAllData } from '../db'

export default function BackupRestore() {
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')

  async function handleBackup() {
    try {
      setStatus('loading')
      setMessage('備份中⋯')
      const token = await getAccessToken()
      const data = await exportAllData()
      await backupToDrive(data, token)
      setStatus('success')
      setMessage('✅ 備份成功！資料已存到 Google Drive')
    } catch (e) {
      setStatus('error')
      setMessage('❌ 備份失敗：' + e.message)
    }
  }

  async function handleRestore() {
    const confirmed = window.confirm('還原會覆蓋目前所有資料，確定繼續？')
    if (!confirmed) return
    try {
      setStatus('loading')
      setMessage('還原中⋯')
      const token = await getAccessToken()
      const data = await restoreFromDrive(token)
      await importAllData(data)
      setStatus('success')
      setMessage('✅ 還原成功！請重新整理頁面。')
    } catch (e) {
      setStatus('error')
      setMessage('❌ 還原失敗：' + e.message)
    }
  }

  async function handleRestoreFromFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const confirmed = window.confirm('還原會覆蓋目前所有資料，確定繼續？')
    if (!confirmed) {
      e.target.value = ''
      return
    }
    try {
      setStatus('loading')
      setMessage('讀取檔案中⋯')
      const text = await file.text()
      const data = JSON.parse(text)
      await importAllData(data)
      setStatus('success')
      setMessage('✅ 還原成功！請重新整理頁面。')
    } catch (e) {
      setStatus('error')
      setMessage('❌ 還原失敗：' + e.message)
    }
    e.target.value = ''
  }

  const btnBase = {
    color: '#FFFFFF',
    border: '1.5px solid rgba(255,255,255,0.30)',
    padding: '12px 20px',
    borderRadius: 18,
    cursor: 'pointer',
    fontWeight: 800,
    fontFamily: 'inherit',
    fontSize: 14,
    transition: 'all 0.15s ease',
  }

  return (
    <div style={{ padding: '16px' }}>

      {/* Google Drive */}
      <div style={{ fontSize: 12, color: '#9A8898', fontWeight: 700, marginBottom: 8 }}>
        Google Drive 備份
      </div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
        <button
          onClick={handleBackup}
          disabled={status === 'loading'}
          style={{
            ...btnBase,
            background: 'linear-gradient(135deg, #9BBCE8 0%, #80A1D4 100%)',
            boxShadow: '0 6px 18px rgba(128,161,212,0.38)',
            opacity: status === 'loading' ? 0.6 : 1,
          }}
        >
          備份到 Google Drive
        </button>
        <button
          onClick={handleRestore}
          disabled={status === 'loading'}
          style={{
            ...btnBase,
            background: 'linear-gradient(135deg, #8FD8D7 0%, #75C9C8 100%)',
            boxShadow: '0 6px 18px rgba(117,201,200,0.38)',
            opacity: status === 'loading' ? 0.6 : 1,
          }}
        >
          從 Google Drive 還原
        </button>
      </div>

      {/* 本地檔案 */}
      <div style={{ fontSize: 12, color: '#9A8898', fontWeight: 700, marginBottom: 8 }}>
        從本地 JSON 檔案還原
      </div>
      <div style={{ fontSize: 11, color: '#9A8898', marginBottom: 10 }}>
        可匯入別人給你的備份檔，還原後會覆蓋目前所有資料。
      </div>
      <input
        type="file"
        accept=".json"
        onChange={handleRestoreFromFile}
        disabled={status === 'loading'}
        style={{ fontSize: 13 }}
      />

      {/* 狀態訊息 */}
      {message && (
        <p
          style={{
            marginTop: 16,
            fontWeight: 700,
            color: status === 'error' ? '#D96868' : '#75C9C8',
          }}
        >
          {message}
        </p>
      )}
    </div>
  )
}
