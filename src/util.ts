const connectCodePattern = /^([A-Za-z0-9])+#[0-9]{1,6}$/

export function humanize(input: string) {
    return input.toLowerCase().replace(/(?:_| |\b)(\w)/g, function($1){return $1.toUpperCase().replace('_',' ');});
}

/// if it returns nothing, this means that the input code wasn't valid
export function formattedCodeIfValid(input: string) {
    let result = input.replace("-", "#")

    if (result.length <= 8 && result.match(connectCodePattern))
        return result.toUpperCase()
}