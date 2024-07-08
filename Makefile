SHELL=zsh
.PHONY: serve scrape build publish clean

serve:
	http-server webapp &

scrape:
	(cd backend && node scrape.js) &> $@.log

build:
	(cd backend && node html2md.js) > $@.log
	(cd backend && node concat.js) >> $@.log
	grep --no-filename '^# ' backend/markdown/*.md | cut -c 3- > haystack.txt
	-$(RM) webapp/markdown/*.md
	mkdir -p webapp/categories
	cp backend/categories/*.md backend/categories/filelist.js webapp/categories

publish:
	cp webapp/* -r www-virtual

clean:
	$(RM) -r webapp/markdown backend/markdown backend/html backend/categories
