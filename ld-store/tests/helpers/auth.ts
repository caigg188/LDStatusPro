import { Buffer } from 'node:buffer'

export function authToken(id = '11', claims: Record<string, unknown> = {}) {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, site: 'linux.do', username: `user-${id}`, name: '测试用户', trust_level: 2, exp: 4102444800, ...claims })}.fixture`
}
