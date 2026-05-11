const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const FOLDER_NAME = 'UTA Kasse 備份'
const BACKUP_FILENAME = 'utakasse_backup.json'

// 取得 access token
export function getAccessToken() {
  return new Promise((resolve, reject) => {
    if (!CLIENT_ID) {
      reject(new Error('缺少 Google OAuth Client ID，請設定 VITE_GOOGLE_CLIENT_ID'))
      return
    }
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) reject(response)
        else resolve(response.access_token)
      },
    })
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

// 找或建立備份資料夾
async function getOrCreateFolder(token) {
  // 先搜尋有沒有同名資料夾
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id
  }

  // 沒有就建立新資料夾
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const folder = await createRes.json()
  return folder.id
}

// ===== 備份 =====
export async function backupToDrive(data, tokenFromCaller) {
  const token = tokenFromCaller || await getAccessToken()
  const folderId = await getOrCreateFolder(token)
  const jsonBlob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })

  // 檢查有沒有舊的備份檔
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}' and '${folderId}' in parents and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()

  const metadata = {
    name: BACKUP_FILENAME,
    parents: [folderId],
  }

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'
  let method = 'POST'

  // 有舊備份 → 更新；沒有 → 新建
  if (searchData.files && searchData.files.length > 0) {
    const fileId = searchData.files[0].id
    url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
    method = 'PATCH'

    // ✅ PATCH 需要 metadata，但不能包含 parents
    const patchForm = new FormData()
    patchForm.append(
      'metadata',
      new Blob([JSON.stringify({ name: BACKUP_FILENAME })], { type: 'application/json' })
    )
    patchForm.append('file', jsonBlob)

    const uploadRes = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: patchForm,
    })
    if (!uploadRes.ok) {
      const errText = await uploadRes.text()
      throw new Error(`備份上傳失敗（更新）：${uploadRes.status} ${errText}`)
    }
    return true
  }

  // 新建
  const postForm = new FormData()
  postForm.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  )
  postForm.append('file', jsonBlob)

  const uploadRes = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
    body: postForm,
  })
  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`備份上傳失敗（新建）：${uploadRes.status} ${errText}`)
  }
  return true
}

// ===== 還原 =====
export async function restoreFromDrive(tokenFromCaller) {
  const token = tokenFromCaller || await getAccessToken()
  const folderId = await getOrCreateFolder(token)

  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='${BACKUP_FILENAME}' and '${folderId}' in parents and trashed=false`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const searchData = await searchRes.json()

  if (!searchData.files || searchData.files.length === 0) {
    throw new Error('找不到備份檔案')
  }

  const fileId = searchData.files[0].id
  const fileRes = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  const data = await fileRes.json()
  return data
}