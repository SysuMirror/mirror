import { getInquiry, listInquiries, openInquiries, statuses, updateInquiry } from '../project-inquiries.js'

const instructions = [
  '用法：',
  '  npm run inquiries -- list [pending|accepted|in_progress|done|closed]',
  '  npm run inquiries -- show <工单编号>',
  '  npm run inquiries -- status <工单编号> <状态> [备注]',
].join('\n')

const [command, idOrStatus, nextStatus, ...noteParts] = process.argv.slice(2)
const validId = typeof idOrStatus === 'string' && /^q[0-9a-f]{32}$/.test(idOrStatus)

function print(value) {
  console.log(JSON.stringify(value, null, 2))
}

let db
try {
  if (!command || command === '--help') {
    console.log(instructions)
  } else if (command === 'list' && !nextStatus && (!idOrStatus || statuses.includes(idOrStatus))) {
    db = openInquiries()
    print(listInquiries(db, idOrStatus))
  } else if (command === 'show' && validId && !nextStatus) {
    db = openInquiries()
    const inquiry = getInquiry(db, idOrStatus)
    if (!inquiry) throw new Error('找不到该咨询工单。')
    print(inquiry)
  } else if (command === 'status' && validId && statuses.includes(nextStatus)) {
    db = openInquiries()
    if (!updateInquiry(db, idOrStatus, nextStatus, noteParts.join(' ').trim()))
      throw new Error('找不到该咨询工单。')
    print({ id: idOrStatus, status: nextStatus })
  } else {
    throw new Error(instructions)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  db?.close()
}
