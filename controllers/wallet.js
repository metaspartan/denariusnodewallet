'use strict';

const passport = require('passport');
const User = require('../models/User');
const bitcoin = require('bitcoin');
const WAValidator = require('wallet-address-validator');
const QRCode = require('qrcode');
const unirest = require('unirest');

var sendJSONResponse = function (res, status, content) {
    res.status(status);
    res.json(content);
};

// all config options are optional
var client = new bitcoin.Client({
    host: process.env.DNRHOST,
    port: process.env.DNRPORT,
    user: process.env.DNRUSER,
    pass: process.env.DNRPASS,
    timeout: 30000
});

/**
 * GET /withdraw
 * Withdraw page.
 */
exports.getWithdraw = (req, res) => {
  var username = req.user.email;
  client.getBalance(`dnrw(${username})`, 10, function (error, balance, resHeaders) {
      if (error) return console.log(error);

      if (balance <= 0) {
        balance = 0;
      }
    res.render('account/withdraw', {
        title: 'Send DNR',
        balance: balance
    });
  });
};

exports.addresses = function (req, res) {
  var username = req.user.email;

  //List All Addresses
  client.getAddressesByAccount(`dnrw(${username})`, function (err, addresses, resHeaders) {
      if (err) return console.log(err);

      var addy = addresses.slice(-1)[0];

      client.dumpPrivKey(`${addy}`, function (err, privkey, resHeaders) {
        if (err) return console.log(err);

      res.render('account/addresses', { title: 'My Addresses', user: req.user, addy: addy, addresses: addresses, privkey: privkey });

  });
});

}

exports.wallet = function (req, res) {
    var username = req.user.email;

    //List Balances
    client.getBalance(`dnrw(${username})`, 10, function (error, balance, resHeaders) {
        if (error) return console.log(error);

        if (balance <= 0) {
          balance = 0;
        }

        //List Transactions
        client.listTransactions(`dnrw(${username})`, 5, function (err, transactions, resHeaders) {
            if (err) return console.log(err);

        //List Account Address
        //client.getAccountAddress(`dnrw(${username})`, function (error, address, resHeaders) {
        client.getAddressesByAccount(`dnrw(${username})`, function (err, addresses, resHeaders) {
            if (error) return console.log(error);

            var address = addresses.slice(-1)[0];

            if (typeof address == 'undefined') {
                client.getNewAddress(`dnrw(${username})`, function (error, addr, resHeaders) {
                  if (error) return console.log(error);
                  address = addr;
                });
            }

            var qr = 'denarius:'+address;

            unirest.get("https://api.coinmarketcap.com/v1/ticker/denarius-dnr/")
              .headers({'Accept': 'application/json'})
              .end(function (result) {
                var usdprice = result.body[0]['price_usd'] * balance;
                var btcprice = result.body[0]['price_btc'] * balance;

            QRCode.toDataURL(qr, function(err, qrcode) {

            res.render('account/wallet', { title: 'My Wallet', user: req.user, usd: usdprice.toFixed(2), btc: btcprice.toFixed(8), address: address, qrcode: qrcode, balance: balance.toFixed(8), transactions: transactions });

            });
          });
          });
        });
    });
    /**
    var batch = [];
    for (var i = 0; i < 10; ++i) {
        batch.push({
            method: 'getbalance',
            params: [`dnrw(${username})`],
            method: 'getaddressesbyaccount',
            params: [`dnrw(${username})`]
        });
    }
    client.cmd(batch, function (err, balance, addresses, resHeaders) {
        if (err) return console.log(err);

        console.log(`${username}`, 'Addresses:', addresses, 'Balance:', balance);
    });
    */
};

//POST GET NEW ADDRESS

exports.address = function (req, res) {
    var username = req.user.email;

    client.getNewAddress(`dnrw(${username})`, function (error, address, resHeaders) {
        if (error) return console.log(error);

        var qr = 'denarius:'+address

        QRCode.toDataURL(qr, function(err, data_url) {

        res.render('account/newaddress', { title: 'New DNR Address', user: req.user, address: address, data_url: data_url });
    });
  });
};

/**
 * POST /withdraw
 * Send Denarius funds
 */
exports.withdraw = (req, res, next) => {
	  var fee = 0.0001;
    var username = req.user.email;
    var sendtoaddress = req.body.sendaddress;
    var amount = req.body.amount;

    client.getBalance(`dnrw(${username})`, 10, function (error, balance, resHeaders) {
        if (error) return console.log(error);

    var valid = WAValidator.validate(`${sendtoaddress}`, 'DNR');

    if (parseFloat(amount) - fee > balance) {

        req.flash('errors', { msg: 'Withdrawal amount exceeds your DNR balance'});
        return res.redirect('/withdraw');

    } else {

    if (valid) {

        client.sendFrom(`dnrw(${username})`, `${sendtoaddress}`, parseFloat(`${amount}`), 10, function (error, sendFromtx, resHeaders) {
            if (error) {

                req.flash('errors', { msg: 'Insufficient Funds or Invalid Amount!' });
                return res.redirect('/withdraw');

            } else {

                var sendtx = sendFromtx;
                var vamount = parseFloat(`${amount}`);

                req.flash('success', { msg: `Your ${vamount} DNR was sent successfully! TX ID: ${sendtx}` });
                return res.redirect('/withdraw');
            }
        });

    } else {

        req.flash('errors', { msg: 'You entered an invalid Denarius (DNR) Address!' });
        return res.redirect('/withdraw');
    }
  }
  });
};

exports.transactions = function (req, res) {
      var username = req.user.email;

      //List Transactions
      client.listTransactions(`dnrw(${username})`, 10000, function (err, transactions, resHeaders) {
          if (err) return console.log(err);

        res.render('account/tx', { title: 'Transactions', user: req.user, transactions: transactions });
        });

};
