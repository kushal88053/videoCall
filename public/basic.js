function myFunction() {
  console.log("myfunction");
  document
    .getElementById("setting-myDropdown")
    .classList.toggle("setting-show");
}

window.onclick = function (event) {
  if (!event.target.matches(".setting-dropbtn")) {
    var dropdowns = document.getElementsByClassName("setting-dropdown-content");
    var i;
    for (i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains("setting-show")) {
        openDropdown.classList.remove("setting-show");
      }
    }
  }
};
