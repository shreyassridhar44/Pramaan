import { ApiError } from './client'

/** Multipart upload to /api/v1/documents, which the generated client does not model. */
export async function uploadDocument<T>(
  file: File,
  kind: string,
  declared?: Record<string, string>,
): Promise<T> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('kind', kind)
  if (declared) fd.append('declared', JSON.stringify(declared))
  const token =
    document.cookie
      .split('; ')
      .find((c) => c.startsWith('pramaan_csrf='))
      ?.split('=')[1] ?? ''
  const res = await fetch('/api/v1/documents', {
    method: 'POST',
    body: fd,
    credentials: 'include',
    headers: { 'x-csrf-token': token },
  })
  const body = await res.json()
  if (!res.ok)
    throw new ApiError(
      body?.error?.code ?? 'upload_failed',
      body?.error?.message ?? 'Upload failed.',
    )
  return body as T
}

/** Fetches a demo-mode specimen document as a File, ready to upload. */
export async function specimenFile(name: string): Promise<File> {
  const res = await fetch(`/api/v1/documents/specimens/${name}`, { credentials: 'include' })
  if (!res.ok) throw new ApiError('specimen_unavailable', 'Specimen not available.')
  const blob = await res.blob()
  const disposition = res.headers.get('content-disposition') ?? ''
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${name}.pdf`
  return new File([blob], filename, { type: blob.type })
}
