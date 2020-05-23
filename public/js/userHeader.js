var token = window.location.href.split('/')[4]
function logout() {
    url = '/logout'
    window.location.href = url
}
function newbill() {
    url = '/customer'
    window.location.href = url
}
document.getElementById('add-new-product').href = '/addproduct'