SHELL=zsh
.PHONY: serve scrape build clean

serve:
	http-server webapp &

scrape:
	cd server && node scrape.js 2>&1 | tee $@.log

build:
	cd server && node html2md.js
	$(RM) webapp/markdown/*.md
	cp server/markdown/*.md webapp/markdown

clean:
	$(RM) webapp/markdown server/markdown server/html
