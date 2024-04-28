import { Context, h, Time, Schema } from 'koishi'
import { } from '@koishijs/cache'
import { join } from 'path';
var request = require("request");
var fs = require("fs");

export const name = 'touhou-fortune'

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
    slip_record: Array<{ group: string, time: number }>
  }
}

export interface Config {
  sharedAmongGroups: boolean
}

export const Config: Schema<Config> = Schema.object({
  sharedAmongGroups: Schema.boolean().default(false)
}).i18n({
  'zh-CN': require('./locales/zh-CN'),
})

async function getfileByUrl(url: string, dir: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    let stream = fs.createWriteStream(dir);
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
  const defaultsource = "https://raw.githubusercontent.com/Dawnzed/Touhou-Fortune-slip/main/Touhou_Fourtune_Slips.json"
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
  try {
    var data = fs.readFileSync(join(__dirname, 'Touhou_Fourtune_Slips.json'), 'utf8');
    var config = JSON.parse(data);
  } catch (err) {
    console.log(`Error reading file from disk: ${err}`);
  }
  try {
    var slips: Slip[] = config.slips
    var source: string = config.source
  } catch (e) {
    var slips: Slip[] = [{ id: 0, sign: "", content: ["签文文件读取错误"] }]
    var source: string = defaultsource
  }

  ctx.command('touhou-fortune').alias('求签')
    .action(async ({ session }) => {
      var record = await ctx.cache.get('slip_record', String(session.userId))
      if (record) {
        for (let { group, time } of record) {
          if (isSameDay(time, Date.now()) && (cfg.sharedAmongGroups || group == session.guildId)) {
            return session.text('.too-frequent')
          }
        }
      } else {
        record = []
      }
      //如果cache里能存map就只需要下面这一行就能搞定了
      let exist = false
      for (let i = 0; i < record.length; i++) {
        if (record[i].group == String(session.guildId)) {
          record[i].time = Date.now()
          exist = true
        }
      }
      if (!exist){
        record.push({ group: String(session.guildId), time: Date.now() })
      }
      //record.set(String(session.guildId), Date.now())
      ctx.cache.set('slip_record', String(session.userId), record, 2 * Time.day)
      //console.log(record)
      const idx = Math.floor(Math.random() * slips.length)
      var res: string = h.at(session.userId) + ".\n "
      for (var i = 0; i < slips[idx].content.length; i++) {
        res += slips[idx].content[i] + "\n"
      }
      return res
    })
  ctx.command('update-slips')
    .action(async ({ session }) => {
      try {
        await getfileByUrl(source, join(__dirname, 'Touhou_Fourtune_Slips.json'))
      } catch (err) {
        return session.text('.update-fail')
      }
      try {
        var data = fs.readFileSync(join(__dirname, 'Touhou_Fourtune_Slips.json'), 'utf8');
        var config = JSON.parse(data);
        source = config.source
        slips = config.slips
      } catch (err) {
        source = defaultsource
        return session.text('.update-fail')
      }
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
