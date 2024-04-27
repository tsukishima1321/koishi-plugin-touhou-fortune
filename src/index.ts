import { Context, Schema, h, Time } from 'koishi'
import { } from '@koishijs/cache'
import { join } from 'path';
var request = require("request");
var fs = require("fs");

export const name = 'touhou-fortune'

export interface Config {
  dataDir: string
}

export const Config: Schema<Config> = Schema.object({
  dataDir: Schema.string().default("./Touhou_Fourtune_Slips.json"),
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
})

export const inject = {
  required: ['cache'],
  optional: [],
}

interface Slip {
  content: string[],
  id: number,
  sign: string,
}

declare module '@koishijs/cache' {
  interface Tables {
    slip_record: number
  }
}

async function getfileByUrl(url: string, dir: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let stream = fs.createWriteStream(join(__dirname, dir));
    request(url).pipe(stream).on("close", (err) => {
      if (err) {
        console.error(err);
        reject(err)
      } else {
        console.log("更新完成");
        resolve(true)
      }
    });
  })
}

function isSameDay(timestamp1: number, timestamp2: number): boolean {
  const date1 = new Date(timestamp1)
  const date2 = new Date(timestamp2)
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

export function apply(ctx: Context, cfg: Config) {
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
  var slips: Slip[] = require(cfg.dataDir).slips
  var source: string = require(cfg.dataDir).source
  ctx.command('touhou-fortune').alias('求签')
    .action(async ({ session }) => {
      const record = await ctx.cache.get('slip_record', String(session.userId))
      if (record) {
        if (isSameDay(record, Date.now())) {
          await session.send(session.text('.too-frequent'))
          return
        }
      }
      ctx.cache.set('slip_record', String(session.userId), Date.now(), 2 * Time.day)
      const idx = Math.floor(Math.random() * slips.length)
      var res: string = h.at(session.userId) + ".\n "
      for (var i = 0; i < slips[idx].content.length; i++) {
        res += slips[idx].content[i] + "\n"
      }
      return res
    })
  ctx.command('update-slips')
    .action(async ({ session }) => {
      await getfileByUrl(source, cfg.dataDir)
      slips = require(cfg.dataDir).slips
      try {
        if (slips.length == 0) {
          return session.text('.update-fail')
        }
      } catch (e) {
        return session.text('.update-fail')
      }
      return session.text('.update-success')
    })
}
