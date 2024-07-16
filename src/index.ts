import { Context, h, Time, Schema } from 'koishi'
import { } from '@koishijs/cache'
var request = require("request");
var fs = require("fs");

export const name = 'touhou-fortune'

export const inject = {
  required: ['cache'],
  optional: [],
}

declare module '@koishijs/cache' {
  interface Tables {
    slip_record: Array<{ group: string, time: number }>
  }
}

export interface Config {
  sharedAmongGroups: boolean
  defaultSlips: string
  groupConfig: object
}

export const Config: Schema<Config> = Schema.object({
  sharedAmongGroups: Schema.boolean().default(false),
  defaultSlips: Schema.path().default("./data/fortune/Touhou_Fortune_Slips.json"),
  groupConfig: Schema.dict(Schema.path()).role('table').default({ "123456": "./data/fortune/Touhou_Fortune_Slips.json" }),
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

interface Slip {
  content: string[],
  id: number,
  sign: string,
}

export function apply(ctx: Context, cfg: Config) {
  ctx.i18n.define('zh-CN', require('./locales/zh-CN'))
  try {
    if (!fs.existsSync("./data/fortune")) {
      fs.mkdirSync("./data/fortune")
    }
  } catch (err) {
    console.error(err)
    console.error("请检查文件权限")
  }
  let slipFiles: Map<string, Array<Slip>> = new Map()
  try {
    let data = fs.readFileSync(cfg.defaultSlips, 'utf8');
    let parsed = JSON.parse(data);
    let slips: Slip[]
    try {
      slips = parsed.slips
    } catch (e) {
      slips = [{ id: 0, sign: "", content: ["签文文件读取错误"] }]
    }
    slipFiles.set("default", slips.concat())
  } catch (err) {
    console.log(`Error reading file from disk: ${err}`);
  }
  for (let key of Object.keys(cfg.groupConfig)) {
    //console.log(`${key}: ${cfg.groupConfig[key]}`);
    try {
      let data = fs.readFileSync(cfg.groupConfig[key], 'utf8');
      let parsed = JSON.parse(data);
      let slips: Slip[]
      try {
        slips = parsed.slips
      } catch (e) {
        slips = [{ id: 0, sign: "", content: ["签文文件读取错误"] }]
      }
      slipFiles.set(key, slips.concat())
    } catch (err) {
      console.log(`Error reading file from disk: ${err}`);
    }
  }
  console.log(slipFiles)

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
      if (!exist) {
        record.push({ group: String(session.guildId), time: Date.now() })
      }
      //record.set(String(session.guildId), Date.now())
      ctx.cache.set('slip_record', String(session.userId), record, 2 * Time.day)
      //console.log(record)
      let slips = slipFiles.get(session.guildId)
      if(!slips){
        slips = slipFiles.get("default")
      }
      console.log(slips)
      const idx = Math.floor(Math.random() * slips.length)
      var res: string = h.at(session.userId) + ".\n "
      for (var i = 0; i < slips[idx].content.length; i++) {
        res += slips[idx].content[i] + "\n"
      }
      return res
    })
}
