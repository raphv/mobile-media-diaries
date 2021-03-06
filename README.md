# Mobile Media Diaries

A basic configurable web-based media diary.

Diary entries are stored centrally on a server, so researchers can easily access participants' data.

You can specify questions to which diary entries should match, as well as limits in the number of diary entries.

Diary entries can contain any of the following:
- An image upload
- A location on a map
- A day chosen from a preset range
- An emoticon, chosen from a preset list of emojis
- A free text field

The list of fields available to the end-user is fully configurable.

At the moment, the diary is set up so that diary organisers need to give out passcodes to their participants. This isn't very secure, future plans are to turn this into a login and password based system.

### Alternative diaries

If you expect participants to have poor connectivity, you may consider using apps that can work offline.

Example of mobile apps that can be used as a diary include dedicated apps (e.g. Flava) and note-taking apps such as Evernote or OneNote.

Alternatives also include blogging apps such as Tumblr and Wordpress.

## Known issues

### Connectivity

Though very basic mechanisms have been implemented to cope with flaky connectivity (multiple retries), the app was built to be used online and doesn't work well in poor connectivity situations.

### Low memory error on Android

There is an issue when running the diary on Android phones with low memory: When opening an image, the operating system may forcibly clear the diary browser tab from memory to free resources.
Therefore, when returning to the tab, the page is reloaded and the entry is lost.
There is no work around at the moment (packaging the diary as an Android app is an option though).
This can be simulated on higher-end Android devices in Developer Options (Don't keep activities)

## Installing server

Node.js has to be installed first:
- Node.js downloads page: https://nodejs.org/download/
- On ubuntu, please use the latest stable release, which is required by the express modules

    $ sudo add-apt-repository ppa:chris-lea/node.js
    $ sudo apt-get update
    $ sudo apt-get install nodejs -y

MongoDB has to be installed as well:
- Downloads page: https://www.mongodb.org/downloads
- Installation instructions: https://docs.mongodb.org/manual/installation/
- On ubuntu:

    $ sudo apt-get install -y mongodb-org
    $ sudo mkdir /data/db
    $ sudo service mongod start

Another requirement is imagemagick (or graphicsmagick, see Configuration options):
- Downloads page: http://www.imagemagick.org/script/binary-releases.php
- On ubuntu: sudo apt-get install imagemagick

The database used for the app is called by default "media-diaries" (can be changed in the config file, see below) and will be automagically created by MongoDB the first time the server is started.

Finally, local Node.js modules are not included in the repositories, you must install them using npm from the server directory.

    $ cd server
    $ npm install

## Setting the admin password

This is done using the command line:

    $ cd server
    $ node setpassword.js

## Running server

    $ cd server
    $ npm start

Default port is 3000. If you wish to use another port:

    $ PORT=8000 npm start

If you wish to run as a self-restarting service, look at the different options on express's site: http://expressjs.com/advanced/pm.html
E.g. with forever

    $ sudo npm install forever -g
    $ forever start -l forever.log -o out.log -e err.log server/bin/www
    
If you wish to run it on the :80 port in an apache sub-directory, use ProxyPass.
This is not a recommended option if you expect high traffic, but it's very useful for a quick setup.
Here is an example of an Apache configuration at /etc/apache2/sites-enabled/diaries.conf

    <Location /diaries/>
        ProxyPass http://localhost:3000/
        ProxyPassReverse http://localhost:3000/
    </Location>
    Redirect /diaries /diaries/
    # The absence of a traling slash would break HTTP request paths

## Using app

Go to http://localhost:3000/

There are no user accounts per se at the moment. Any text string will be used as a user identifier at the moment, and using the same code twice will allow you to access the "user"'s saved diary entries.

## Configuration

Configuration options are being migrated to a single **config.js** file.

This file is copied from the config-sample.js file at install time, to avoid having it under version control.

### Server-side configuration

- **db_connection** specifies the 'hostname:port/database_name' used to connect to mongodb
- **db_collection** is the name of the mongodb collection
- **video_converter_command** is the path to either ffmpeg or avconv
- **image_converter_command** is the path to the ImageMagick command line (convert)

### Client-side configuration

Only child properties of 'client_config' will be available client-side.

See comments in the file for more details on configuration options.

## Admin pages

Admin pages are password-protected.

Admin password is encrypted in the database. See the installation section above for instructions to set password.

You can:
- generate unique account IDs at http://localhost:3000/admin/id-generator Reload this page if you need more than 10 IDs.
- list users and see how many entries they've contributed at http://localhost:3000/admin/active-users
- see which questions are the most popular at http://localhost:3000/admin/popular-questions
- export a dump of the diary entries database at http://localhost:3000/admin/dump-data/

## Dependencies/Libraries used

### Server-side

#### Needed before install

- Node.js
- NPM
- MongoDB
- ImageMagick or GraphicsMagick

#### Installed using NPM

See the contents of server/package.json

### Client-side

The following libraries are all currently loaded through CDNs:

- Angular.JS
- Leaflet
- FontAwesome
- Leaflet Awesome Markers
- Google Fonts Roboto
- Twemoji

## Todo List

- Improve security:
    - switch the passcode system to a full user management system
- Offer a 'takeaway' (e.g. download) page
