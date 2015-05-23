/*
 * TweetMotiif is licensed under the Apache License 2.0: 
 *  http://www.apache.org/licenses/LICENSE-2.0.html
 *  Copyright Brendan O'Connor, Michel Krieger, and David Ahn, 2009-2010.
 */

/*
 * Node.js Port of Brendan O'Conner's twokenize.py & Jason Baldridge's Scala Port
 * 
 * - Thomas Holloway (nyxtom@gmail.com)
 *   November 2012
 */

var contractions = /(\w+)(n't|'ve|'ll|'d|'re|'s|'m)$/i;
var whitespace = /\s+/;

var punctChars = "['“\\\".?!,:;]";
var punctSeq = punctChars + "+";
var entity = "&(amp|lt|gt|quot);";

// URLS
// Nov 2012 Edit: Going with the daringfireball.net/2010/07/improved_regex_for_matching_urls
//  - copying from Gruber's URL matching regex ala http://gist.github.com/1033143
var urlStart1  = "(https?://|www\\.)";
var commonTLDs = "(com|co\\.uk|org|net|info|ca|ly|mp|edu|gov|io|vi|ry)";
var urlStart2  = "[A-Za-z0-9\\.-]+?\\." + commonTLDs + "(?=[/ \\W])";
var urlBody    = "[^ \\t\\r\\n<>]*?";
var urlExtraCrapBeforeEnd = "("+punctChars+"|"+entity+")+?";
var urlEnd     = "(\.\.+|[<>]|\\s|$)";
var url        = "\\b("+urlStart1+"|"+urlStart2+")"+urlBody+"(?=("+urlExtraCrapBeforeEnd+")?"+urlEnd+")";

// Numeric
var timeLike = "\\d+:\\d+";
var numNum = "\\d+\\.\\d+";
var numberWithCommas = "(\\d+,)+?\\d{3}(?=([^,]|$))";

// Note the magic 'smart quotes' (http://en.wikipedia.org/wiki/Smart_quotes)
var edgePunctChars = "\'\\\"“”‘’<>«»{}\\(\\)\\[\\]";
var edgePunct = "[" + edgePunctChars + "]";
var notEdgePunct = "[a-zA-Z0-9]";
var offEdge = "(^|$|:|;|\\s)";
var edgePunctCharP = new RegExp(edgePunct + "+", "g");
var edgePunctLeft = new RegExp(offEdge + "(" + edgePunct + "+)(" + notEdgePunct + ")", "g");
var edgePunctRight = new RegExp("(" + notEdgePunct + ")(" + edgePunct + "+)" + offEdge, "g");

// Abbreviations
var boundaryNotDot = "($|\\s|[“\\\"?!,:;]|" + entity + ")";
var aa1 = "([A-Za-z]\\.){2,}(?=" + boundaryNotDot + ")";
var aa2 = "[^A-Za-z]([A-Za-z]\\.){1,}[A-Za-z](?=" + boundaryNotDot + ")";
var standardAbbreviations = "\\b([Mm]r|[Mm]rs|[Mm]s|[Dd]r|[Ss]r|[Jj]r|[Rr]ep|[Ss]en|[Ss]t)\\.";
var arbitraryAbbrev = "(" + aa1 + "|" + aa2 + "|" + standardAbbreviations + ")";

var separators = "(--+|-)";
var decorations = "[♫]+";
var thingsThatSplitWords = "[^\\s\\.,]";
var embeddedApostrophe = thingsThatSplitWords + "+\'" + thingsThatSplitWords + "+";

// Emoticons
var normalEyes = "[:=]";
var wink = "[;]";
var noseArea = "(|o|O|-|[^a-zA-Z0-9 ])";
var happyMouths = "[D\\)\\]]+";
var sadMouths = "[\\(\\[]+";
var tongue = "[pP]";
var otherMouths = "[doO/\\\\]+";

function or(parts) {
    return "(" + parts.join("|") + ")";
};

var emoticon = or([
    // Standard version :) :( :] :D :P
    "(" + normalEyes + "|" + wink + ")" + 
    noseArea + 
    "(" + tongue + "|" + otherMouths + "|" + sadMouths + "|" + happyMouths + ")",

    // reversed version (: D: use positive lookbehind to remove (word):"
    // because eyes on the right side is more ambiguous with the standard usage of : ;
    "(?<=( |^))" + or([sadMouths, happyMouths, otherMouths]) + noseArea + or([normalEyes, wink])

    // TODO: japanese-style emoticons
    // TODO: should try a big precompiled lexicon from Wikipedia
]);

var hashtag = "\\#+[\w_]+[\\w\\\'_\\-]*[\\w_]+"; // also gets #1 #40 which probably aren't hashtags but are good
var atMention = "(^|\\s)+(@[\\w_]+)";
var atMentionP = new RegExp(atMention);
var email = "\\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}\\b";

// We will be tokenizing using these regexps as delimiters
var expressions = [url, email, entity, timeLike, numNum, numberWithCommas, arbitraryAbbrev, separators, decorations, embeddedApostrophe, hashtag, atMention, "(?:\\S)"];
var protectedExp = new RegExp("(" + expressions.join("|") + ")/g");

// The main work of tokenizing a tweet
function simpleTokenize(text) {
    //separate hashtags: useful for instagram-like texts
    text = separateHashtags(text);
    //remove html tags
    text = removeHtmlTags(text);

    // Do the no-brainers first
    var splitPunctText = splitEdgePunct(text);
    var textLength = splitPunctText.length;

    // Find the matches for subsequences that should be protected, 
    // e.g. URLS, 1.0, U.S.A., 12:53
    var goodSpans = [];
    var badSpans = [];
    if (protectedExp.test(splitPunctText)) {
        var matches;
        var i = 0;
        while ((matches = protectedExp.exec(splitPunctText)) != null) {
            var index = protectedExp.lastIndex - matches[0].length;
            if (index >= 0) {
                goodSpans.push({ start: i, end: index });
                badSpans.push({ start: index, end: protectedExp.lastIndex});
                i = protectedExp.lastIndex;
            }
        }
        goodSpans.push({ start: protectedExp.lastIndex, end: textLength});
    }
    else {
        goodSpans = [{ start: 0, end: textLength }];
    }

    // Splice all the good strings in solid chunks
    var goods = [];
    for (var i = 0; i < goodSpans.length; i++) {
        var str = splitPunctText.slice(goodSpans[i].start, goodSpans[i].end);
        goods.push(str);
    }

    // Splice all the bad strings in solid chunks
    var bads = [];
    for (var i = 0; i < badSpans.length; i++) {
        var str = splitPunctText.slice(badSpans[i].start, badSpans[i].end);
        bads.push(str);
    }

    // The 'good' strings are safe to be further tokenized by whitespace
    var splitGoods = [];
    for (var i = 0; i < goods.length; i++) {
        splitGoods.push(goods[i].trim().split(" "));
    }

    var res = [];
    for (var i = 0; i < bads.length; i++) {
        res = res.concat(splitGoods[i]);
        res.push(bads[i]);
    }
    if (splitGoods.length > 0)
        res = res.concat(splitGoods[splitGoods.length - 1]);

    return res.filter(function (str) { return str.length > 0 });
};

function removeHtmlTags(text) {
     return text.replace(/<\/?[^>]+(>|$)/g, "");
}

function separateHashtags(text) {
    return text.replace(/#/ig, " #");
}

function splitEdgePunct(text) {
    var splitLeft = text.replace(edgePunctLeft, "$1$2 $3");
    return splitLeft.replace(edgePunctRight, "$1 $2$3");
};

function squeezeWhitespace(text) {
    return text.replace(whitespace, " ").trim();
};

function apply(text) {
    return simpleTokenize(squeezeWhitespace(text));
};

function tokenize(text) {
    return apply(text);
};

module.exports.tokenize = tokenize;
