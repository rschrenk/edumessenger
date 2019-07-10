var COURSES = {
    debug: 10,

    /**
     * list courses of a site.
     * @param site site to list courses.
     * @param placer html element to use for injection.
     * @param predecessor if true will insertAfter place, else will append to placer.
     */
    listCourses: function(site, placer, predecessor) {
        if (COURSES.debug > 0) { console.log('COURSES.listCourses(site, placer, predecessor)', site, placer, predecessor); }
        if (typeof site.courses !== 'undefined') {
            var courses = listObjBy(site.courses, ['fullname', 'id']);
            Object.keys(courses).forEach(function(k) {
                var course = courses[k];
                //console.log(course);
                var li = $('#courses li.' + site.hash + '.course-' + course.id);
                if (li.length == 0) {
                    li = $('<li>').addClass(site.hash + ' course-' + course.id).append([
                        $('<a>').append([
                            $('<h3 class="coursename">'),
                            //$('<p class="coursesummary">'),
                        ]).attr('href', '#').attr('onclick', 'if (COURSES.listCourse(' + site.hash + ', ' + course.id + ')) { UI.navigate("#course"); }')
                    ]);
                    if (predecessor) {
                        li.insertAfter(placer);
                    } else {
                        placer.append(li);
                    }
                    placer = li;
                    predecessor = true;
                }
                li.find('.coursename').html(course.fullname);
                //li.find('.coursesummary').html(course.summary);
            });
        }
    },
    /**
     * List content of a course
     * @param sitehash
     * @param courseid
     * @param structureloaded true if course structure has been reloaded recently.
     */
    listCourse: function(sitehash, courseid, structureloaded) {
        if (COURSES.debug > 0) { console.log('COURSES.listCourse(sitehash, courseid, structureloaded)', sitehash, courseid, structureloaded); }
        // @todo check if this course is still shown.
        var site = MOODLE.siteGet(sitehash);
        if (typeof site === 'undefined' || typeof site.courses === 'undefined' || typeof site.courses[courseid] === 'undefined') {
            UI.alert(language.t('Unkown_error_occurred'));
            return;
        }
        if (typeof structureloaded === 'undefined' || !structureloaded) {
            COURSES.loadStructure(site, courseid);
            $('#course').attr('data-sitehash', sitehash).attr('data-courseid', courseid);
        } else if ($('#course').attr('data-sitehash') != sitehash || $('#course').attr('data-courseid') != courseid) {
            return;
        }
        var course = site.courses[courseid];
        $('#course div[data-role="header"] h1').html(course.fullname);

        var courseforums = $('#course #ul-course-forums').empty();
        var coursestructure = $('#course #ul-course-structure').empty();
        if (typeof course.forums !== 'undefined' && Object.keys(course.forums).length > 0) {
            Object.keys(course.forums).forEach(function(key){
                var forum = course.forums[key];
                courseforums.append([
                    $('<li>').append([
                        $('<a>').append([
                            $('<img>').attr('src', 'img/icon.png').attr('alt', language.t('Forum')),
                            $('<h3>').html(forum.name),
                            $('<p>').html(LIB.stripHTML(forum.intro)),
                        ]).attr('href', '#').attr('onclick', 'DISCUSSIONS.show(' + site.hash + ', ' + course.id + ', ' + forum.id + ', 1)'),
                    ]),
                ]);
            });
        }
        try { $(courseforums).listview('refresh') } catch (e) {}
        if (typeof course.structure !== 'undefined' && Object.keys(course.structure).length > 0) {
            Object.keys(course.structure).forEach(function(key){
                var section = course.structure[key];
                coursestructure.append([
                    $('<li data-role="list-divider">').append([
                        $('<h3>').html(section.name),
                        $('<p>').html(LIB.stripHTML(section.intro)),
                    ]),
                ]);
                if (typeof section.modules !== 'undefined' && Object.keys(section.modules).length > 0) {
                    Object.keys(section.modules).forEach(function(key) {
                        var module = section.modules[key];
                        coursestructure.append([
                            $('<li>').append([
                                $('<a>').append([
                                    $('<img>').attr('src', module.iconurl).attr('alt', module.modname),
                                    $('<h3>').html(module.name),
                                    $('<p>').html(LIB.stripHTML(module.intro)),
                                ]).attr('href', MOODLE.getLaunchURL(sitehash, module.url)).attr('target', '_blank'),
                            ]),
                        ]);
                    });
                }
            });
        }
        try { $(coursestructure).listview('refresh') } catch (e) {}
        return true;
    },
    /**
     * Loads the structure of a course and recalls listCourse.
     */
    loadStructure: function(site, courseid) {
        CONNECTOR.schedule({
            data: {
                act: 'get_course_structure',
                courseid: courseid,
            },
            identifier: 'get_course_structure_' + site.sitehash + '_' + site.userid + '_' + courseid,
            site: site,
        }, true);
    }
}
