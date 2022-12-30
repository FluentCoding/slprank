import { FastifyReply } from "fastify";
import path from "path";
import Twig from 'twig';

const connectCodePattern = /^([A-Za-z0-9])+#[0-9]{1,6}$/

export function humanize(input: string) {
    if (input)
        return input.toLowerCase().replace(/(?:_| |\b)(\w)/g, function($1){return $1.toUpperCase().replace('_',' ');});
}

/// if it returns nothing, this means that the input code wasn't valid
export function formattedCodeIfValid(input: string) {
    let result = input.replace("-", "#")

    if (result.length <= 8 && result.match(connectCodePattern))
        return result.toUpperCase()
}

export async function template(reply: FastifyReply, template: string, twigData?: any) {
    reply.header('Content-Type', 'text/html; charset=utf-8')
    return new Promise((resolve, reject) => {
        Twig.renderFile(path.resolve('./views', `${template}.twig`), twigData, (err, html) => {
          if (err) return reject(err)
          resolve(html)
        })
    })
}

export function timeSince(date: Date) {
    // @ts-ignore
    var seconds = Math.floor((new Date() - date) / 1000);
  
    var interval = seconds / 31536000;
  
    if (interval > 1) {
      return Math.floor(interval) + " years";
    }
    interval = seconds / 2592000;
    if (interval > 1) {
      return Math.floor(interval) + " months";
    }
    interval = seconds / 86400;
    if (interval > 1) {
      return Math.floor(interval) + " days";
    }
    interval = seconds / 3600;
    if (interval > 1) {
      return Math.floor(interval) + " hours";
    }
    interval = seconds / 60;
    if (interval > 1) {
      return Math.floor(interval) + " minutes";
    }
    return Math.floor(seconds) + " seconds";
}