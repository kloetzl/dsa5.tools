SHELL=zsh
.PHONY: serve scrape build clean

serve:
	http-server webapp &

scrape:
	cd backend && node scrape.js 2>&1 | tee $@.log

build:
	cd backend && node html2md.js > build.log
	-$(RM) webapp/markdown/*.md
	mkdir -p webapp/markdown
	cp backend/markdown/*.md backend/markdown/filelist.js webapp/markdown

clean:
	$(RM) -r webapp/markdown backend/markdown backend/html
