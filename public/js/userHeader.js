var token = window.location.href.split('/')[4]
function logout() {
    url = '/logout'
    window.location.href = url
}
function newbill() {
    url = '/billing/' + token
    window.location.href = url
}
document.getElementById('add-new-product').href = '/addproduct'