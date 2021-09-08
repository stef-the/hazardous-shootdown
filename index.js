const body = document.getElementsByTagName('body')[0]
body.innerText = 'hello world'
$.getscript("sketch.js",function(){
  sketch_game();
});
