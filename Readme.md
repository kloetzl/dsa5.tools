# DSA5.tools

Dieses Project ist eine Alternative zum offiziellen Regelwiki von
Ulisses. Das Ziel ist es eine Seite anzubieten die, mit einer mächtigen
Suche ausgestattet, einen schneller bestimmte Artikel finden lässt. Zudem
ist es gut ein Backup zu haben, falls das offizielle Wiki mal wieder
ausfällt.

## Konzept

Dieses Project besteht aus zwei Teilen: das Backend und die Webapp. Das
Backend nutzt Node.js um eine lokale Kopie des Regelwikis anzulegen
und konvertiert alle Artikel in Markdown. Die Webapp wiederum lädt die
Markdowndateien und rendert sie auf einer Seite, potentiell gefiltert.

## Usage

    cd backend
    npm install
    cd ..
    make scrape
    make build
