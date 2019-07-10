var AVAILABILITY = {
    /**
    ** Builds the base table for the availability.
    **/
    availabilityBuilder: function(){
        var user = DB.getConfig('user', {});
        user.timezone = user.timezone || 0;

        $('#availability-grid thead th').each(function(){
            $(this)
            .css('display','table-cell')
            .css('padding','0px')
            .css('margin','1px')
            .css('height','20px')
            .addClass('ui-btn')
            .addClass('ui-shadow');
        });

        var tbody = $('#availability-grid tbody');
        for(var a=0;a<24;a++){
            var tr = $('<tr>');
            tr.append($('<th>')
            .html(a)
            .css('display','table-cell')
            .css('padding','0px')
            .css('margin','1px')
            .css('height','20px')
            .addClass('ui-btn')
            .addClass('ui-shadow')
            .attr('onclick','AVAILABILITY.availabilityToggle(this);')
            .attr('data-id','h-'+a));
            for(var b=0;b<7;b++) {
                var id = a+(b*24);
                var td = $('<td>')
                .addClass('availability-'+id)
                .attr('onclick','AVAILABILITY.availabilityToggle(this);')
                .attr('data-id',id)
                .html('&nbsp;');
                tr.append(td);
            }
            tbody.append(tr);
        }
        AVAILABILITY.availabilitySet();
    },
    /**
    ** Sets active and inactive fields in table.
    **/
    availabilitySet: function(){
        if($('#availability-grid tbody td').length==0) AVAILABILITY.availabilityBuilder();

        var grid = AVAILABILITY.availabilityZoned().split('');
        for(var a=0;a<grid.length;a++)
        if(grid[a]=='0')
        $('#availability-grid .availability-'+a).removeClass('active').addClass('inactive');
        else
        $('#availability-grid .availability-'+a).addClass('active').removeClass('inactive');
    },
    /**
    ** Shifts the availability-information to the current timezone.
    **/
    availabilityZoned: function(){
        var user = DB.getConfig('user', {});
        user.timezone = (new Date()).getTimezoneOffset()/60;
        var grid = user.availability || '';
        var timezone = (user.timezone) || 0;
        if(grid.length === 168) {
            if(timezone<0)
            grid = grid.substring(grid.length+timezone)+grid.substring(0,grid.length+timezone);
            else
            grid = grid.substring(timezone)+grid.substring(0,timezone);
        } else {
            grid = '';
            for(a=0;a<168;a++) grid += '1';
        }

        return grid;
    },
    /**
    ** Toggles a cell, row or col.
    ** @param DOMObject td Table-cell that was toggled.
    **/
    availabilityToggle: function(td){
        var grid = AVAILABILITY.availabilityZoned().split('');
        var id = $(td).attr('data-id');

        if(id.substring(0,1)=='a'){
            var to = (grid[0]=='1')?'0':'1';
            for(var a=0;a<grid.length;a++) grid[a] = to;
        } else if(id.substring(0,1)=='d'){
            var d = parseInt(id.substring(2));
            var to = (grid[d*24]=='1')?'0':'1';

            for(var a=d*24;a<((d*24)+24);a++)
            grid[a] = to;
        } else if(id.substring(0,1)=='h'){
            var h = parseInt(id.substring(2));
            var to = (grid[h]=='1')?'0':'1';
            var d = 0;
            for(var a=0;a<grid.length;a++) {
                if(a>0 && a%24==0) d++;
                if((d*24+h)==a)
                grid[a] = to;
            }
        } else {
            grid[id] = (grid[id]=='1')?'0':'1';
        }

        var user = DB.getConfig('user', {});
        user.timezone = (new Date()).getTimezoneOffset()/60;
        var timezone = user.timezone*-1;
        var grid = grid.join('');
        if(timezone<0) {
            grid = grid.substring(grid.length+timezone)+grid.substring(0,grid.length+timezone);
        } else {
            grid = grid.substring(timezone)+grid.substring(0,timezone);
        }

        user.availability = grid;
        AVAILABILITY.availabilitySet();
        DB.setConfig('user', user);
        CONNECTOR.schedule({
            type: 'central',
            identifier: 'set_availability',
            data: {
                act: 'set_availability',
                availability: user.availability,
                timezone: user.timezone,
            },
        }, true);
    },
}
