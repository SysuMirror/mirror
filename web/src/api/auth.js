import AES from 'crypto-js/aes'
import Utf8 from 'crypto-js/enc-utf8'
import SHA256 from 'crypto-js/sha256'
import { apiRequest, setToken } from './client'

function encryptPassword(plain, key = '16bit secret key') {
  const cypherKey = Utf8.parse(key)
  while (cypherKey.sigBytes < 16)
    cypherKey.concat(Utf8.parse('\0'))
  const iv = SHA256(key).toString().slice(0, 16)
  return AES.encrypt(plain, cypherKey, { iv: Utf8.parse(iv) }).toString()
}

export async function login(email, password) {
  const res = await apiRequest('/auth/login', {
    method: 'POST',
    auth: false,
    body: { email, password: encryptPassword(password) },
  })
  const token = res.token || res?.data?.token
  if (!token)
    throw new Error('登录失败：未返回 token')
  setToken(token)
  return token
}

const MIRROR_API_BASE = '/mirror-api'

// 镜像站 /mirror-api/* 是另一套接口（登录、注册），同样走统一出口，
// 只是 base 不同、不带主站 token、错误文案字段是 error。
async function mirrorRequest(path, body) {
  return apiRequest(path, {
    method: 'POST',
    body,
    auth: false,
    base: MIRROR_API_BASE,
    raw: true,
  })
}

export async function unissoLogin(email, password) {
  return mirrorRequest('/auth/login', { email, password })
}

export async function registerStart(email, password, username, fullName) {
  return mirrorRequest('/auth/register/start', {
    email,
    password,
    username: username || undefined,
    fullName: fullName || undefined,
  })
}

export async function registerResend(pendingId) {
  return mirrorRequest('/auth/register/resend', { pendingId })
}

export async function registerVerify(pendingId, code, password, confirmPassword) {
  const data = await mirrorRequest('/auth/register/verify', {
    pendingId,
    code,
    password,
    confirmPassword,
  })
  setToken(data.token)
  return data.user
}

export async function fetchQuestMe() {
  const data = await apiRequest('/auth/quest/me')
  return data.me
}
