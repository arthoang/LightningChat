/*
 * Author: Andrew Hoang
 * Date: 02 Feb, 2022
 * File: chat.js
 * 
*/

var selectedConversationId = null;
var selectedContact = null;
var userName = null;
var loginUserId = null;
var authToken = null;
var lastPollTime = null;
var welcomeMsg = null;


//API URL
var apiBaseUrl = "http://localhost:8000/api/";
var findConversationsByUserIdUrl = apiBaseUrl + "conversations/"; //+ userId - GET
var createConversationsUrl = apiBaseUrl + "conversations"; // POST
var deleteEmptyConverstationUrl = apiBaseUrl + "conversations/"; //DELETE + conversationId
var getChatLogsByConversationIdUrl = apiBaseUrl + "logs/"; //+ conversationId - GET; POST to get latest one
var sendChatUrl = apiBaseUrl + "logs"; //POST
var getUsersUrl = apiBaseUrl + "users/"; //GET



//processing vars
var autoPoll;

var searchUserInput;
var usersFetchedArray;
var conversationListFetched;

//Collator
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

//UI Elements
var newConversationModal;
var userListEl;

//on document ready
$(async function() {
        //on document ready:
//register listener: button: new chat, log out, send message, enter key pressed

//if list of conversation is not empty
//  register click listener for each conversation
//  select first conversation
//  load chat logs for selected conversation
//else 
//  modal asking user to start new chat
//end if
//register interval poll

        //check if user is logged in
        loginUserId = localStorage.getItem('ChatUID');
        authToken = localStorage.getItem('AuthToken');
        userName = localStorage.getItem('ChatUserName');
        
        
        if (loginUserId === undefined || authToken === undefined || loginUserId === null || authToken === null) {
            //unauthorized
            //transfer to login page
            window.location.replace("login.html");
        }
        //initialize vars
        newConversationModal= $('aside.modal-dialog');
        userListEl = $('aside.modal-dialog').find('div#user-result-list');
        welcomeMsg = $('p#welcome-msg');

        welcomeMsg.text('Welcome ' + userName);

        //register click listener for new chat
        $('a#logoutButton').click(
            function(event) {
                logout();
            }
        )
        //register click listener for log out
        $('a#newChatButton').click(
            function(event) {
                newChat();
            }
        )
        //register click listener for send chat
        $('a#sendChatButton').click(
            function(event) {
                event.preventDefault();
                var chatBox = $('input#chat-input');
                sendChat(chatBox.val());
                //clear box
                chatBox.val("");
            }
        )

        //register enter listener for chat input
        $('input#chat-input').keypress(function(event) {
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if(keycode == '13'){
                event.preventDefault();
                sendChat(event.target.value);
                event.target.value = "";
            }
        })

        //register change listener for search user inpu
        $('input#user-input').on('input', function(event) {
            searchUser(event.target.value);
        })
        
        //get conversations by userId
        await loadConversationList();
        
        //load chat logs
        loadChatLogs();
        // setTimeout(function() {
            
        // }, 500);

        //set interval 5 sec to poll new chats
        autoPoll = setInterval(pollChat, 5000);
    }
);

function searchUser(query) {
    
    //empty the list
    userListEl.empty();
    
    if (query !== "") {
        //transform conversation object array into just participant ID for filtering
        var existingContactIds = conversationListFetched.map(c => c.participant);
        
        //filter user with query
        //1 those not in conversationList
        //2 those match query
        usersFetchedArray
        .filter(e => !existingContactIds.includes(e.id))
        .filter(el => el.name.toLowerCase().indexOf(query.toLowerCase()) !== -1)
        .sort((a,b) => {
            collator.compare(a.name, b.name);
        })
        .forEach(user => {
            //for each user, populate the dom
            var userEl = document.createElement('p');
            userEl.className = "user-item";
            userEl.id = user.id;
            userEl.textContent = user.name;
            //register click event
            $(userEl).on('click', function(event) {
                createConversation(event.target.id);
            })
            //add children
            userListEl.append(userEl);
        });
    }
    
}

function createConversation(to) {
    //close dialog
    newConversationModal.dialog('close');
    //reset user input field
    $('input#user-input').val("");

    //call api to create new conversations
    if (to !== null && loginUserId !== null) {
        var data = {
            "from": loginUserId,
            "to": to
        };
    
        $.ajax({
            type: 'POST',
            url: createConversationsUrl,
            data: JSON.stringify(data),
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: beginChat
        }).fail(function() {
            console.log("request failed");
            renderInformationMessage("Oops. Something's wrong with the server");
        });
    }
}

function beginChat(resp) {
    
    //perform active conversation selection
    if (resp.success) {
        if (resp.data.length > 0) {
            if (selectedConversationId !== null) {
                var currentSelectedDiv = $("div#"+selectedConversationId);
                toggleActiveClasses(currentSelectedDiv);    
                //delete conversation if empty
                deleteIfEmpty(selectedConversationId);
            }
            
            //clear the current chat logs
            var chatLogContainerEl = $('section.list-container').find('div.chat-log');
            chatLogContainerEl.empty();
            //get ID from first element
            
            otherParty = resp.data.filter(a => {
                return a.participant !== loginUserId;
            });
            
            selectedConversationId = otherParty[0].id;
            selectedContact = otherParty[0].participantName;
            
            var createdTime = otherParty[0].created_at;
            
            //reset lastPollTime
            lastPollTime = parseInt((new Date(createdTime).getTime() / 1000).toFixed(0));
            selectConversation();
        }
    }
    
}

function deleteIfEmpty(conversationId) {
    if (conversationId !== null) {
        $.ajax({
            type: 'DELETE',
            url: deleteEmptyConverstationUrl + conversationId,
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: function() {
                
            }
        }).fail(function() {
            console.log("request failed");
            renderInformationMessage("Oops. Something's wrong with the server");
        });
    }
}

function pollChat() {

    if (lastPollTime !== null) {
        var data = {
            "lastPolled": lastPollTime
        };
    
        //load conversation list
        loadConversationList();
    
        $.ajax({
            type: 'POST',
            url: getChatLogsByConversationIdUrl + selectedConversationId,
            data: JSON.stringify(data),
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: renderChatLogsUi
        }).fail(function(resp) {
            console.log("request failed");
            console.log(resp);
            renderInformationMessage("Oops. Something's wrong with the server");
        });
    }
    //clearInterval(autoPoll);
}

async function loadConversationList() {
    let convListResp;
    try {
        convListResp = await $.ajax({
            type: 'GET',
            url: findConversationsByUserIdUrl + loginUserId,
            
        });

        renderConversationListUi(convListResp);
    } catch (error) {
        console.log(error);
        renderInformationMessage("Oops. Something's wrong with the server");
    }
    
}

function renderConversationListUi(resp) {
    //get list of conversation using userId
    var conversationLayoutEl = $('section.main-chat-container').find('div.list-items');
    //clear list
    conversationLayoutEl.empty();
    
    if (resp.success) {
        conversationListFetched = resp.data;
        if (conversationListFetched.length > 0) {
            var previousItem = null;
            conversationListFetched.forEach(conv => {
                //iterate each key value pair of the object
                /*
                each item layout as below
                <div class="contact-container contact-active">
                    <div class="contact-item">
                        <p class="contact-name">Contact Name</p>
                        <p class="last-message-time">Friday, 17th Feb2022</p>
                    </div>
                    <p class="last-message">
                        Hello world from myself Hello world from myself Hello world from myself Hello world 
                    </p>
                    
                </div>
                */

                if (selectedConversationId === null) {
                    //no active conversation yet. default to first one
                    selectedConversationId = conv.id;
                    selectedContact = conv.participantName;
                }
                
                //container
                var contactContainer = document.createElement("div");
                contactContainer.className="contact-container";
                contactContainer.id = conv.id;

                if (conv.id === selectedConversationId) {
                    contactContainer.classList.add("contact-active");
                    if (previousItem !== null) {
                        //toggle no border of previous child
                        previousItem.classList.add("contact-no-border");
                    }
                    //set lastPollTime to latest time of message
                    if (conv.lastMessageTime !== null) {
                        lastPollTime = conv.lastMessageTime;
                    } else {
                        lastPollTime = parseInt((new Date(conv.created_at).getTime() / 1000).toFixed(0));
                    }
                    

                }
                //top row
                var topRow = document.createElement("div");
                topRow.className = "contact-item";

                //contact name
                var contactName = document.createElement("p");
                contactName.className = "contact-name";
                contactName.textContent = conv.participantName;
                //last message time
                var lastMessageTime = document.createElement("p");
                lastMessageTime.className = "last-message-time";
                lastMessageTime.textContent = timeConverter(conv.lastMessageTime);

                topRow.appendChild(contactName);
                topRow.appendChild(lastMessageTime);

                //bottom row
                var bottomRow = document.createElement("p");
                bottomRow.className = "last-message";
                const message = (conv.lastMessage.length > 50) ? conv.lastMessage.substring(0, 50) +"...": conv.lastMessage;
                bottomRow.textContent = message;

                contactContainer.appendChild(topRow);
                contactContainer.appendChild(bottomRow);

                previousItem = contactContainer;

                //register select conversation listener
                $(contactContainer).click(function (event) {
                    //only perform action if selected id is different from current one
                    if (conv.id !== selectedConversationId) {
                        //toggle active classes for current active div
                        var currentSelectedDiv = $("div#"+selectedConversationId);
                        toggleActiveClasses(currentSelectedDiv);
                        //delete conversation if empty
                        deleteIfEmpty(selectedConversationId);
                        //clear the current chat logs
                        var chatLogContainerEl = $('section.list-container').find('div.chat-log');
                        chatLogContainerEl.empty();
                        //perform active conversation selection
                        selectedConversationId = conv.id;
                        selectedContact = conv.participantName;
                        //reset lastPollTime
                        selectedConv = conversationListFetched.filter(a => {
                            return a.id === selectedConversationId;
                        })[0];
                        
                        //lastPollTime = (selectedConv.lastMessageTime === null) ? parseInt((new Date(selectedConv.created_at).getTime() / 1000).toFixed(0)) : selectConversation.lastMessageTime;
                        lastPollTime = selectedConv.lastMessageTime;
                        selectConversation();
                    }
                    
                })

                //add to parent list
                conversationLayoutEl.append(contactContainer);
                
            })
        } else {
            console.log("No chat yet. Create new one");
        }
    } else {
        console.log(resp.error);
    }
}

function selectConversation() {
    //toggle active classes
    var selectedDiv = $("div#"+selectedConversationId)
    toggleActiveClasses(selectedDiv);
    //load messages
    loadChatLogs();
}

function loadChatLogs() {
    if (selectedConversationId !== null) {
        $.ajax({
            type: 'GET',
            url: getChatLogsByConversationIdUrl + selectedConversationId,
            success: renderChatLogsUi
        }).fail(function() {
            console.log("request failed");
            renderInformationMessage("Oops. Something's wrong with the server");
        });
    }    
}

function renderChatLogsUi(resp) {
    //update chat contact
    var toContact = $('p#to-contact');
    toContact.text("To: " + selectedContact);
    
    var chatLogContainerEl = $('section.list-container').find('div.chat-log');

    if (resp.success) {
        var chatLogsFetched = resp.data;
        if (chatLogsFetched.length > 0) {
            chatLogsFetched.forEach(chat => {
                //chat layout as below
                // <p class="chat-dialog other">
                //     Hello
                // </p>
                // <p class="chat-dialog self">
                //     From myself
                // </p>
                var chatEl = document.createElement("p");
                const sender = chat.from;
                const additionalClassName = (sender === loginUserId) ? "self" : "other";
                chatEl.className = "chat-dialog " + additionalClassName;
                chatEl.textContent = chat.message;
                chatLogContainerEl.append(chatEl);
            })
        }
    }
    //scroll to bottom
    chatLogContainerEl.scrollTop(chatLogContainerEl.prop('scrollHeight'));
}

function logout() {
    localStorage.removeItem('ChatUID');
    localStorage.removeItem('AuthToken');
    localStorage.removeItem('ChatUserName');
    window.location.replace("login.html");
}

function newChat() {
    showModal();
}
function sendChat(message) {
    
    if (message.trim().length > 0 && selectedConversationId !== null) {
        data = {
            "from" : loginUserId,
            "message" : message.trim(),
            "conversationId": selectedConversationId
        };
        
        $.ajax({
            type: 'POST',
            url: sendChatUrl,
            data: JSON.stringify(data),
            contentType:"application/json; charset=utf-8",
            dataType:"json",
            success: renderChatLogsUi
        }).fail(function() {
            console.log("request failed");
            renderInformationMessage("Oops. Something's wrong with the server");
        });
    }
    
}

function showModal() {
    //empty search list
    userListEl.empty();
    //fetch users into array
    $.ajax({
        type: 'GET',
        url: getUsersUrl + loginUserId,
        success: saveUsersArray
    }).fail(function() {
        console.log("request failed");
        renderInformationMessage("Oops. Something's wrong with the server");
    });
    
    newConversationModal.dialog({
        modal: true,
        resizable: false,
        draggable: false,
        open: openDialog,
        close: function() {
            console.log("close");
        },
        show: {
            effect: 'clip',
            duration: 300,
        }
    });
}

function saveUsersArray(resp) {
    if (resp.success) {
        //save to array
        usersFetchedArray = resp.data;
    } else {
        console.log(resp.error);
    }
}


function openDialog() {
    $('body').addClass('stop-scrolling');
}

function toggleActiveClasses(currentActiveDiv) {
    var prevDiv = currentActiveDiv.prev();
    currentActiveDiv.toggleClass("contact-active");
    if (prevDiv.length > 0) {
        prevDiv.toggleClass("contact-no-border");
    }
}

function timeConverter(unixTime) {
    var a = new Date(unixTime * 1000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var year = a.getFullYear();
    var month = months[a.getMonth()];
    var date = a.getDate();
    var output = date + ' ' + month + ' ' + year;
    return output;
}