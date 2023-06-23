SHELL=zsh
.PHONY: serve scrape build clean

serve:
	http-server webapp &

scrape:
	cd backend && node scrape.js 2>&1 | tee $@.log

build:
	cd backend && node html2md.js
	$(RM) webapp/markdown/*.md
	cp backend/markdown/*.md webapp/markdown

clean:
	$(RM) webapp/markdown backend/markdown backend/html
