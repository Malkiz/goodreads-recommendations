
/*const goodreads = require('goodreads-api-node');
const myCredentials = {
  key: 'sjL1i9sRRHOO0DnjAxvJ2Q',
  secret: 'FK4uhyqdG4TgpKhUHwiz4SBX8kA6oNZjxPQt4Z8hKg'
};

const gr = goodreads(myCredentials);*/

/*var http = require('http');
var https = require('https');
var express = require('express');
var app = express();

app.get('/auth_user', function (req, res) {
	doAuth();
	res.send('fetching...');
});

var httpServer = http.createServer(app);
httpServer.listen(8080);
*/
const puppeteer = require('puppeteer');
var browser;
var page;

const _ = require('lodash');

/*gr.initOAuth('http://localhost:8080/auth_user/');
gr.getRequestToken()
.then(console.log);
*/
const userID = 24662006;

/*function doAuth() {
	console.log('fetching...');
	return gr.getAccessToken()
	.then(() => getData(userID))
}
*/

getData(userID);

async function getData(user_id) {
	browser = await puppeteer.launch();
	page = await browser.newPage();

	return getAllRatedBooksForUser(userID)
	.then(getMatchingReviews)
	.then(getRecommendations)
	// .then(res => scrape(res.books.book[0].link, () => jQuery('[id^="review_"]').get().map(e => e.id.replace('review_', ''))))
	// .then(res => gr.getReview(res[0]))
	// .then(res => gr.getUserInfo(res.review.user.id))
	// .then(res => gr.getBooksOnUserShelf(res.id, res.user_shelves.user_shelf[0].name/*, [queryOptions]*/)
	// 	.then(res2 => gr.getUsersReviewForBook(res.id, res2.books.book[0].id._))
	// )
	.then(console.log)
	.catch(console.log)
	.then(() => browser.close())
	.then(() => process.exit());
}

/*function getAllRatedBooksForUser(user_id) {
	return getAllUserBooks(user_id)
	.then(res => Promise.all(res.map(book => gr.getUsersReviewForBook(user_id, book.id))))
	.then(results => results.reduce((arr, res) => arr.concat(res.review), [])
		.map(mapReviewObj)
		.filter(review => review.rating !== 0))
}

function getAllUserBooks(user_id) {
	return gr.getUserInfo(user_id)
	.then(res => Promise.all(res.user_shelves.user_shelf
		.map(shelf => gr.getBooksOnUserShelf(user_id, shelf.name))
	))
	.then(results => _.uniqBy(
		results.reduce((arr, res) => arr.concat(res.books.book), [])
		.map(mapBookObj), 'id'))
}

function mapBookObj(book) {
	return {
		id: book.id._,
		title: book.title,
		link: book.link
	};
}

function mapReviewObj(review) {
	return {
		id: review.id,
		user_id: review.user.id,
		book_id: review.book.id._,
		link: review.link,
		rating: Number(review.rating)
	};
}*/

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