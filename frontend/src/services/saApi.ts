import axios from 'axios'

const BASE = ((import.meta as any).env?.VITE_API_URL ?? '/api') + '/superadmin'

export const saApi = axios.create({ baseURL: BASE })

saApi.interceptors.request.use(cfg => {
  const token = localStorage.getItem('sa_access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

saApi.interceptors.response.use(
  r => r,
  err => {
    if (err?.response?.status === 401 || err?.response?.status === 403) {
      localStorage.removeItem('sa_access_token')
      window.location.href = '/superadmin/login'
    }
    return Promise.reject(err)
  }
)

export const saApiError = (err: any, fallback = 'Error') =>
  err?.response?.data?.detail ?? fallback
