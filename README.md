node-twokenize
==============

Node.js port and update of Jason Baldrige's Twokenize with layers for hashtag, @mention, email and urls.

Twokenize was written originally by Brendar O' Connor's twokenizer.py.
This is a port of a port (scala version to be exact) (meta! :P) created by
Jason Baldrige. Additional modifications were made to fix some problems
with edge punctuation and handling other various entities like hashtags,
@username and emails. 

This is not fully intended for production use as there are plenty of other
useful tokenizers and nlp libraries that do this sort of thing better.
Though it does give some insight into some nice regex patterns for
handling various types of common entities and a nice overview on
manual tokenization.

INSTALL
-------

    npm install twokenize


USAGE
-----

    var tokens = require('twokenize').tokenize('rt @username: this is some
    neat stuff #awesome google.com/chrome.');

    console.log(tokens);

