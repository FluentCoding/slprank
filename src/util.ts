const connectCodePattern = /^([A-Za-z0-9])+#[0-9]{1,6}$/
const ratingToRank = []

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

// converts bronze3 to Bronze 3, grandmaster to Grandmaster, etc.
export function rankCase(str: string) {
    var splitStr = str.toLowerCase().split(' ');
    for (var i = 0; i < splitStr.length; i++) {
        splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
    }
    // Directly return the joined string
    const result = splitStr.join(' ');
    if (isNaN(result.charAt(result.length - 1) as any))
        return result
    else
        return `${result.substr(0, result.length - 1)} ${result.charAt(result.length -1)}`
}