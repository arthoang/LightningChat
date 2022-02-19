/*
 * Author: Andrew Hoang
 * Date: 02 Feb, 2022
 * File: auth.js
 * 
*/


//API URL
const apiBaseUrl = "http://localhost:8000/api/";
const loginUrl = apiBaseUrl + "login";
const registerUrl = apiBaseUrl + "register";

//processing vars
var userId;
var pw;
var errorMsg;

//on document ready
$(function() {
    userId = $('input#userId');
    pw = $('input#pw');
    errorMsg = $('p#error-msg');

    //register buttons
    $('a#login-btn').on('click', function(event) {
        if (validate()) {
            login();
        };
        
    });

    $('a#register-btn').on('click', function(event) {
        if (validate()) {
            register();
        }
    });


});

function validate() {
    errorMsg.text("");
    if (!errorMsg.hasClass('hidden')) {
        errorMsg.toggleClass('hidden');
    }

    if (userId.val().trim().length === 0) {
        showError("Username cannot be blank");
        return false;
    }
    if (pw.val().trim().length === 0) {
        showError("Password cannot be blank")
        return false;
    }
    return true;
}

function showError(msg) {
    errorMsg = $('p#error-msg');
    errorMsg.text(msg);
    if (errorMsg.hasClass('hidden')) {
        errorMsg.toggleClass('hidden');
    }
}

function login() {
    var data = {
        "name": userId.val().trim(),
        "password": pw.val()
    };

    $.ajax({
        type: 'POST',
        url: loginUrl,
        data: JSON.stringify(data),
        contentType:"application/json; charset=utf-8",
        dataType:"json",
        success: processResponse
    }).fail(function(resp) {
        processError(resp, true);
    });
}

function register() {
    //call api
    //if success, set local storage
    //redirect to index
    //else show error
    var data = {
        "name": userId.val().trim(),
        "password": pw.val()
    };

    $.ajax({
        type: 'POST',
        url: registerUrl,
        data: JSON.stringify(data),
        contentType:"application/json; charset=utf-8",
        dataType:"json",
        success: processResponse
    }).fail(function(resp) {
        processError(resp, false);
    });
}

function processError(resp, isLogin) {
    console.log(resp);
    if (isLogin) {
        showError(resp.responseJSON.data.error);
    } else {
        showError(resp.responseJSON.data.name);
    }
    
}

function processResponse(resp) {
    if (resp.success) {
        localStorage.setItem('ChatUID',resp.data.id);
        localStorage.setItem('ChatUserName', resp.data.name);
        localStorage.setItem('AuthToken',resp.data.token);
        window.location.replace("index.html");
    } else {
        showError(resp.data.error);
    }
}

