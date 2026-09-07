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

export async function fetchQuestMe() {
  const data = await apiRequest('/auth/quest/me')
  return data.me
}
