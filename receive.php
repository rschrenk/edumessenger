<?php
header("access-control-allow-origin: *");
$allowed = array(
	"js/availability.js",
    "js/cache.js",
    "js/connector.js",
    "js/conversations.js",
    "js/courses.js",
    "js/db.js",
    "js/discussions.js",
    "js/lang.js",
    "js/lib.js",
    "js/moodle.js",
    "js/posts.js",
    "js/push.js",
    "js/ui.js",

    "body.html",
	"version.txt",



	"js/forums.js",
	"js/helper.js",
	"js/instances.js",
    "js/iusers.js",

    "js/messages.js",


	"js/tasks.js",

	"js/user.js",
	"css/gfx.css",
	"css/main.css",
);

$file = urldecode($_GET["file"]);

if(in_array($file,$allowed)) {
	readfile($file);
} else {
	die("Not allowed");
}

?>
