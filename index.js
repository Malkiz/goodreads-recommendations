

const puppeteer = require('puppeteer');
var browser;
var page;

const _ = require('lodash');

const userID = 24662006;

getData(userID);

async function getData(user_id) {
	browser = await puppeteer.launch();
	page = await browser.newPage();

	return getAllRatedBooksForUser(userID)
	.then(getMatchingReviews)
	.then(getRecommendations)
	.then(console.log)
	.catch(console.log)
	.then(() => browser.close())
	.then(() => process.exit());
}

async function getAllRatedBooksForUser(user_id) {
	var page = 1;
	var all_res = [];
	do {
		var res = await scrape(`https://www.goodreads.com/review/list/${user_id}?page=${page}&per_page=100&sort=rating&utf8=%E2%9C%93&view=reviews`,
			() => jQuery('tr[id^="review_"]').get().map(e => ({
				id: e.id.replace('review_', ''), 
				rating: jQuery(e).find('td.rating span.p10').length, 
				title: jQuery(e).find('td.title a').text().trim().replace(/[\s]+/g, ' '), 
				book_link: jQuery(e).find('td.title a').attr('href')
			}))
		);
		all_res = all_res.concat(res);
		++page;
	} while(res.length > 0 && res[res.length - 1].rating === 5 && page <= 5);
	
	all_res = all_res.filter(r => r.rating === 5);
	all_res.forEach(r => r.bood_id = /\/book\/show\/(\d+)/.exec(r.book_link)[1]);
	return all_res;
}

async function getMatchingReviews(ratedBooks) {
	var all_res = [];
	for (var i = 0; i < 20/*ratedBooks.length*/; i++) {
		var reviews = await getAllReviewsForBook(ratedBooks[i].book_link, ratedBooks[i].rating);
		all_res = all_res.concat(reviews);
		if (reviews.length === 0) break;
	}
	return bestMatchingUsers(all_res, ratedBooks);
}

async function getAllReviewsForBook(book_link, rating) {
	// TODO: pagination
	var res = await scrape(`https://www.goodreads.com${book_link}?rating=${rating}`, 
		() => jQuery('#bookReviews [id^="review_"]').get().map(e => ({
			review_id: Number(e.id.replace('review_', '')),
			user_link: jQuery(e).find('a.user').attr('href'),
			rating: jQuery(e).find('span.p10').length
		})));
	res.forEach(r => r.user_id = /\/user\/show\/(\d+)/.exec(r.user_link)[1]);
	return res;
}

function bestMatchingUsers(reviews, ratedBooks) {
	return _.toArray(_.groupBy(reviews, 'user_id'))
	.filter(arr => arr.length >= 3)
	.sort((a,b) => b.length - a.length)
	.map(arr => arr[0].user_id);
}

async function getRecommendations(users) {
	/*
	{
		123: {
			book_id: 123,
			ratings: {5: , 4: , ...}
		}
	}
	*/
	console.log(users);
	var all_res = {};
	for (var i = 0; i < users.length; i++) {
		var res = await getAllRatedBooksForUser(users[i]);
		res.forEach(b => {
			all_res[b.bood_id] = all_res[b.bood_id] || b;
			all_res[b.bood_id].ratings = all_res[b.bood_id].ratings || {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
			all_res[b.bood_id].ratings[b.rating] += 1;
		});
	}
	return _.toArray(all_res)
	.filter(a => a.ratings[5] >= 2)
	.sort((a,b) => b.ratings[5] - a.ratings[5])
}

async function scrape(url, evalCB) {
	console.log(url);
	await page.goto(url, {waitUntil: 'networkidle2'});
	try {
		var res = await page.evaluate(evalCB);
	} catch(ex) {
		console.log('BLOCKED!!!');
		res = [];
	}
	return res;
}