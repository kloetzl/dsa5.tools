SHELL=zsh
.PHONY: serve scrape build clean

serve:
	http-server webapp &

scrape:
	(cd backend && node scrape.js) &> $@.log

build:
	(cd backend && node html2md.js) > $@.log
	(cd backend && node concat.js) > $@.log
	-$(RM) webapp/markdown/*.md
	mkdir -p webapp/categories
	cp backend/categories/*.md backend/categories/filelist.js webapp/categories

clean:
	$(RM) -r webapp/markdown backend/markdown backend/html backend/categories
